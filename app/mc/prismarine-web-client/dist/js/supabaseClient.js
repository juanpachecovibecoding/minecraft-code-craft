/**
 * Supabase Client Integration for Prismarine + VisualModder
 */
(function (window) {
  'use strict';

  const SupabaseService = {
    client: null,
    currentUser: null,
    config: {
      url: window.SUPABASE_URL || localStorage.getItem('pc_supabase_url') || '',
      anonKey: window.SUPABASE_ANON_KEY || localStorage.getItem('pc_supabase_anon_key') || ''
    },

    async init(url, anonKey) {
      if (url && anonKey) {
        this.config.url = url;
        this.config.anonKey = anonKey;
        localStorage.setItem('pc_supabase_url', url);
        localStorage.setItem('pc_supabase_anon_key', anonKey);
      }

      // Try reading from config.json if not configured
      if (!this.config.url || !this.config.anonKey) {
        try {
          const res = await fetch('/config.json');
          if (res.ok) {
            const data = await res.json();
            if (data.supabaseUrl && data.supabaseAnonKey) {
              this.config.url = data.supabaseUrl;
              this.config.anonKey = data.supabaseAnonKey;
            }
          }
        } catch (e) {
          console.warn('[Supabase] Could not fetch config.json', e);
        }
      }

      if (!this.config.url || !this.config.anonKey) {
        console.info('[Supabase] Supabase URL or Anon Key not configured yet.');
        return false;
      }

      // Ensure Supabase JS library is loaded
      if (!window.supabase && !window.createClient) {
        await this._loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      }

      const createClientFn = window.supabase?.createClient || window.createClient;
      if (!createClientFn) {
        console.error('[Supabase] Failed to load @supabase/supabase-js library.');
        return false;
      }

      this.client = createClientFn(this.config.url, this.config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });

      // Check current session
      const { data: { session } } = await this.client.auth.getSession();
      if (session?.user) {
        this.currentUser = session.user;
        this._triggerAuthChange(this.currentUser);
      }

      this.client.auth.onAuthStateChange((event, session) => {
        this.currentUser = session?.user || null;
        this._triggerAuthChange(this.currentUser);
      });

      return true;
    },

    _loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },

    _triggerAuthChange(user) {
      window.dispatchEvent(new CustomEvent('supabase:auth-change', { detail: { user } }));
    },

    _formatEmail(input) {
      const trimmed = (input || '').trim();
      if (trimmed.includes('@')) return trimmed;
      // If user provided simple username, map to pseudo-email for Supabase Auth
      return `${trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '')}@playcode.local`;
    },

    async signUp(usernameOrEmail, password) {
      if (!this.client) await this.init();
      if (!this.client) throw new Error('Supabase no está configurado');

      const email = this._formatEmail(usernameOrEmail);
      const username = usernameOrEmail.trim();

      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            display_name: username
          }
        }
      });

      if (error) throw error;
      this.currentUser = data.user;
      await this.logInteraction('SIGN_UP', { username });
      return data.user;
    },

    async signIn(usernameOrEmail, password) {
      if (!this.client) await this.init();
      if (!this.client) throw new Error('Supabase no está configurado');

      const email = this._formatEmail(usernameOrEmail);

      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      this.currentUser = data.user;
      await this.logInteraction('LOGIN', { email });
      return data.user;
    },

    async signOut() {
      if (!this.client) return;
      await this.logInteraction('LOGOUT', {});
      await this.client.auth.signOut();
      this.currentUser = null;
      this._triggerAuthChange(null);
    },

    getUser() {
      return this.currentUser;
    },

    async saveProject(title, xmlCode, jsCode, projectId = null) {
      if (!this.client) await this.init();
      if (!this.client || !this.currentUser) {
        // Fallback to localStorage if not logged in
        const localProjects = JSON.parse(localStorage.getItem('pc_local_projects') || '[]');
        const existingIdx = localProjects.findIndex(p => p.title === title);
        const projData = {
          id: projectId || 'local_' + Date.now(),
          title: title || 'Proyecto ' + (localProjects.length + 1),
          xml_code: xmlCode,
          js_code: jsCode,
          updated_at: new Date().toISOString()
        };
        if (existingIdx >= 0) {
          localProjects[existingIdx] = projData;
        } else {
          localProjects.push(projData);
        }
        localStorage.setItem('pc_local_projects', JSON.stringify(localProjects));
        return projData;
      }

      const payload = {
        user_id: this.currentUser.id,
        title: title || 'Proyecto sin título',
        xml_code: xmlCode,
        js_code: jsCode,
        updated_at: new Date().toISOString()
      };

      let result;
      if (projectId && !projectId.startsWith('local_')) {
        const { data, error } = await this.client
          .from('blockly_projects')
          .update(payload)
          .eq('id', projectId)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await this.client
          .from('blockly_projects')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      await this.logInteraction('SAVE_PROJECT', { projectId: result.id, title });
      return result;
    },

    async getProjects() {
      if (!this.client) await this.init();
      const localProjects = JSON.parse(localStorage.getItem('pc_local_projects') || '[]');
      
      if (!this.client || !this.currentUser) {
        return localProjects;
      }

      try {
        const { data, error } = await this.client
          .from('blockly_projects')
          .select('id, title, description, updated_at, created_at')
          .order('updated_at', { ascending: false });
        if (error) throw error;
        return [...data, ...localProjects];
      } catch (err) {
        console.warn('[Supabase] Error loading projects from cloud, returning local', err);
        return localProjects;
      }
    },

    async getProject(projectId) {
      if (projectId.startsWith('local_')) {
        const localProjects = JSON.parse(localStorage.getItem('pc_local_projects') || '[]');
        return localProjects.find(p => p.id === projectId) || null;
      }

      if (!this.client) await this.init();
      if (!this.client) throw new Error('Supabase no disponible');

      const { data, error } = await this.client
        .from('blockly_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },

    async deleteProject(projectId) {
      if (projectId.startsWith('local_')) {
        let localProjects = JSON.parse(localStorage.getItem('pc_local_projects') || '[]');
        localProjects = localProjects.filter(p => p.id !== projectId);
        localStorage.setItem('pc_local_projects', JSON.stringify(localProjects));
        return true;
      }

      if (!this.client) await this.init();
      if (!this.client) return false;

      const { error } = await this.client
        .from('blockly_projects')
        .delete()
        .eq('id', projectId);
      if (error) throw error;
      return true;
    },

    async logInteraction(actionType, details = {}) {
      if (!this.client || !this.currentUser) {
        return; // Silent if no active Supabase user
      }
      try {
        await this.client.from('interaction_logs').insert({
          user_id: this.currentUser.id,
          action_type: actionType,
          details: details
        });
      } catch (err) {
        console.warn('[Supabase] Interaction logging skipped:', err.message);
      }
    }
  };

  window.SupabaseService = SupabaseService;

  // Auto initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SupabaseService.init());
  } else {
    SupabaseService.init();
  }
})(window);
