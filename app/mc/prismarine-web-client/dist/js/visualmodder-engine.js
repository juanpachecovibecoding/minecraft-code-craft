/**
 * VisualModder Client Engine in Pure JavaScript
 * Replaces the Java VisualModder plugin to run natively in Singleplayer & Web
 */
(function (window) {
  'use strict';

  class MCLocation {
    constructor(x = 0, y = 64, z = 0, yaw = 0, pitch = 0) {
      this.x = Math.round(x);
      this.y = Math.round(y);
      this.z = Math.round(z);
      this.yaw = Number(yaw) || 0;
      this.pitch = Number(pitch) || 0;
    }

    getX() { return this.x; }
    getY() { return this.y; }
    getZ() { return this.z; }
    getYaw() { return this.yaw; }
    getPitch() { return this.pitch; }

    setX(val) { this.x = Math.round(val); }
    setY(val) { this.y = Math.round(val); }
    setZ(val) { this.z = Math.round(val); }
    setYaw(val) { this.yaw = Number(val); }
    setPitch(val) { this.pitch = Number(val); }

    clone() {
      return new MCLocation(this.x, this.y, this.z, this.yaw, this.pitch);
    }

    toString() {
      return `MCLocation(x=${this.x}, y=${this.y}, z=${this.z}, yaw=${this.yaw}, pitch=${this.pitch})`;
    }
  }

  // Material parser helper
  function parseMaterial(rawMaterial) {
    if (!rawMaterial) return 'stone';
    if (typeof rawMaterial !== 'string') return 'stone';

    // Format can be: "_G_,,_P_,,_D_,,_M_,,_T_,,b.grass_block;" or "b.stone" or "stone"
    const match = rawMaterial.match(/b\.([a-zA-Z0-9_]+)/);
    if (match) return match[1];

    const clean = rawMaterial.replace(/[^a-zA-Z0-9_]/g, '');
    return clean || 'stone';
  }

  const VisualModderEngine = {
    blocksPlaced: 0,
    maxBlocksPerRun: 15000,
    maxExecutionTimeMs: 25000,
    eventHandlers: {},

    getBot() {
      return window.bot || null;
    },

    getWorld() {
      return window.world || (window.bot ? window.bot.world : null);
    },

    getPlayerLocation(playerName) {
      const bot = this.getBot();
      if (bot && bot.entity) {
        const pos = bot.entity.position;
        // In Minecraft: yaw is rotation around Y axis in radians (Mineflayer), convert to degrees
        const yawDeg = bot.entity.yaw ? (bot.entity.yaw * 180 / Math.PI) : 0;
        const pitchDeg = bot.entity.pitch ? (bot.entity.pitch * 180 / Math.PI) : 0;
        return new MCLocation(pos.x, pos.y, pos.z, yawDeg, pitchDeg);
      }
      return new MCLocation(0, 64, 0, 0, 0);
    },

    setBlockAt(x, y, z, blockName) {
      this.blocksPlaced++;
      if (this.blocksPlaced > this.maxBlocksPerRun) {
        throw new Error(`Límite de bloques excedido (${this.maxBlocksPerRun} bloques máx por ejecución).`);
      }

      const bot = this.getBot();
      const cleanBlock = parseMaterial(blockName);

      // Method 1: Send chat command to singleplayer/server
      if (bot && typeof bot.chat === 'function') {
        bot.chat(`/setblock ${Math.round(x)} ${Math.round(y)} ${Math.round(z)} minecraft:${cleanBlock}`);
        return;
      }

      // Method 2: Direct world state modification
      const world = this.getWorld();
      if (world && window.mcData) {
        const blockDef = window.mcData.blocksByName[cleanBlock] || window.mcData.blocksByName['stone'];
        if (blockDef && typeof world.setBlockStateId === 'function') {
          const Vec3 = window.Vec3 || function (x, y, z) { return { x, y, z }; };
          world.setBlockStateId(new Vec3(x, y, z), blockDef.defaultState);
        }
      }
    },

    execute(code, xmlCode = '', playerName = 'Player') {
      this.blocksPlaced = 0;
      const startTime = Date.now();
      const startLocation = this.getPlayerLocation(playerName);
      let nextLocation = startLocation.clone();
      let markLocation = startLocation.clone();
      const startCmdTime = startTime;
      const player = playerName;
      const CMD = this.getCMD();

      try {
        // Execute generated Blockly code
        const runner = new Function(
          'CMD', 'player', 'startLocation', 'nextLocation', 'markLocation', 'startCmdTime', 'MCLocation',
          code
        );

        runner(CMD, player, startLocation, nextLocation, markLocation, startCmdTime, MCLocation);

        const duration = Date.now() - startTime;
        console.log(`[VisualModder] Código ejecutado con éxito: ${this.blocksPlaced} bloques en ${duration}ms`);

        // Log interaction to Supabase
        if (window.SupabaseService) {
          window.SupabaseService.logInteraction('RUN_BLOCKLY', {
            playerName,
            blocksPlaced: this.blocksPlaced,
            durationMs: duration,
            hasXml: !!xmlCode
          });
        }

        return {
          status: 'OK',
          message: `¡Ejecutado con éxito! (${this.blocksPlaced} bloques)`,
          blocksPlaced: this.blocksPlaced,
          duration
        };
      } catch (err) {
        console.error('[VisualModder] Error en ejecución:', err);
        return {
          status: 'ERROR',
          message: err.message || 'Error durante la ejecución del código',
          blocksPlaced: this.blocksPlaced
        };
      }
    },

    getCMD() {
      const self = this;
      return {
        createBlock(location, material, player, startCmdTime) {
          if (!location) return;
          self.setBlockAt(location.getX(), location.getY(), location.getZ(), material);
        },

        createRectangle(location, width, height, fill, material, player, startCmdTime) {
          if (!location) return;
          const w = Math.max(1, Math.min(100, Math.round(width || 1)));
          const h = Math.max(1, Math.min(100, Math.round(height || 1)));
          const isFilled = (fill === true || fill === 'true' || fill === 'FILL');

          const startX = location.getX();
          const startY = location.getY();
          const startZ = location.getZ();

          for (let x = 0; x < w; x++) {
            for (let z = 0; z < h; z++) {
              if (isFilled || x === 0 || x === w - 1 || z === 0 || z === h - 1) {
                self.setBlockAt(startX + x, startY, startZ + z, material);
              }
            }
          }
        },

        createPolygon(location, sides, width, height, fill, material, player, startCmdTime) {
          if (!location) return;
          const rx = Math.max(1, Math.min(50, Math.round((width || 10) / 2)));
          const rz = Math.max(1, Math.min(50, Math.round((height || 10) / 2)));
          const isFilled = (fill === true || fill === 'true' || fill === 'FILL');
          const centerX = location.getX();
          const centerY = location.getY();
          const centerZ = location.getZ();

          for (let x = -rx; x <= rx; x++) {
            for (let z = -rz; z <= rz; z++) {
              const d = (x * x) / (rx * rx) + (z * z) / (rz * rz);
              if (d <= 1.0) {
                if (isFilled || d >= 0.75) {
                  self.setBlockAt(centerX + x, centerY, centerZ + z, material);
                }
              }
            }
          }
        },

        createLine(location, length, material, player, startCmdTime) {
          if (!location) return;
          const len = Math.max(1, Math.min(200, Math.round(length || 1)));
          const yawRad = (location.getYaw() * Math.PI) / 180;
          const dx = -Math.sin(yawRad);
          const dz = Math.cos(yawRad);

          for (let i = 0; i < len; i++) {
            const bx = Math.round(location.getX() + dx * i);
            const bz = Math.round(location.getZ() + dz * i);
            self.setBlockAt(bx, location.getY(), bz, material);
          }
        },

        connectPositions(loc1, loc2, material, player, startCmdTime) {
          if (!loc1 || !loc2) return;
          const x1 = loc1.getX(), y1 = loc1.getY(), z1 = loc1.getZ();
          const x2 = loc2.getX(), y2 = loc2.getY(), z2 = loc2.getZ();

          const dx = x2 - x1;
          const dy = y2 - y1;
          const dz = z2 - z1;
          const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz), 1);

          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            self.setBlockAt(Math.round(x1 + dx * t), Math.round(y1 + dy * t), Math.round(z1 + dz * t), material);
          }
        },

        movePosition(player, location, times = 1, direction = 'FORWARD') {
          if (!location) {
            return self.getPlayerLocation(player);
          }
          const loc = location.clone();
          const dist = Number(times) || 1;
          const yawRad = (loc.getYaw() * Math.PI) / 180;

          switch ((direction || 'FORWARD').toUpperCase()) {
            case 'FORWARD':
              loc.setX(loc.getX() - Math.sin(yawRad) * dist);
              loc.setZ(loc.getZ() + Math.cos(yawRad) * dist);
              break;
            case 'BACKWARD':
              loc.setX(loc.getX() + Math.sin(yawRad) * dist);
              loc.setZ(loc.getZ() - Math.cos(yawRad) * dist);
              break;
            case 'LEFT':
              loc.setX(loc.getX() - Math.cos(yawRad) * dist);
              loc.setZ(loc.getZ() - Math.sin(yawRad) * dist);
              break;
            case 'RIGHT':
              loc.setX(loc.getX() + Math.cos(yawRad) * dist);
              loc.setZ(loc.getZ() + Math.sin(yawRad) * dist);
              break;
            case 'UP':
              loc.setY(loc.getY() + dist);
              break;
            case 'DOWN':
              loc.setY(loc.getY() - dist);
              break;
          }
          return loc;
        },

        copyLocation(location, yaw, pitch) {
          if (!location) return new MCLocation();
          const loc = location.clone();
          if (yaw !== undefined) loc.setYaw(yaw);
          if (pitch !== undefined) loc.setPitch(pitch);
          return loc;
        },

        rotatePositionAbsolute(player, location, angle) {
          const loc = location ? location.clone() : self.getPlayerLocation(player);
          loc.setYaw(Number(angle) || 0);
          return loc;
        },

        rotatePositionRelative(player, location, angle) {
          const loc = location ? location.clone() : self.getPlayerLocation(player);
          loc.setYaw(loc.getYaw() + (Number(angle) || 0));
          return loc;
        },

        setVerticalAxisAbsolute(player, location, angle) {
          const loc = location ? location.clone() : self.getPlayerLocation(player);
          loc.setPitch(Number(angle) || 0);
          return loc;
        },

        setVerticalAxisRelative(player, location, angle) {
          const loc = location ? location.clone() : self.getPlayerLocation(player);
          loc.setPitch(loc.getPitch() + (Number(angle) || 0));
          return loc;
        },

        cloneBlocks(location, player) {
          return location ? location.clone() : new MCLocation();
        },

        createDrawing(location, data, player, startCmdTime) {
          if (!location || !Array.isArray(data)) return;
          data.forEach(item => {
            if (item && item.x !== undefined && item.y !== undefined) {
              self.setBlockAt(location.getX() + item.x, location.getY() + (item.y || 0), location.getZ() + (item.z || 0), item.material || 'stone');
            }
          });
        },

        createChest(location, player, material) {
          if (location) self.setBlockAt(location.getX(), location.getY(), location.getZ(), 'chest');
        },

        convertTextToBlocks(location, player, material, text, font, style, size, startCmdTime) {
          if (!location || !text) return;
          console.log(`[VisualModder] Generando texto en bloques: ${text}`);
          // Simple horizontal line representation
          for (let i = 0; i < text.length * 2; i++) {
            self.setBlockAt(location.getX() + i, location.getY(), location.getZ(), material);
          }
        },

        createWaveFormObj(location, player, filename, size, startCmdTime) {
          console.log('[VisualModder] OBJ import:', filename);
        },

        getPlayerCoord(player, coordName) {
          const loc = self.getPlayerLocation(player);
          switch ((coordName || '').toLowerCase()) {
            case 'x': return loc.getX();
            case 'y': return loc.getY();
            case 'z': return loc.getZ();
            case 'yaw': return loc.getYaw();
            case 'pitch': return loc.getPitch();
            default: return 0;
          }
        },

        giveToPlayer(player, material) {
          const bot = self.getBot();
          const clean = parseMaterial(material);
          if (bot && typeof bot.chat === 'function') {
            bot.chat(`/give ${player} minecraft:${clean} 64`);
          }
        },

        hasPlayerA(player, material) {
          return true;
        },

        isCurrentBlockMadeOf(location, material, player) {
          return true;
        },

        isPlayerHittingA(event, material) {
          return true;
        },

        isPlayerHoldingA(player, material) {
          return true;
        },

        addEvent(player, eventType, callback) {
          self.eventHandlers[eventType] = callback;
        },

        cancelAllEvents(player) {
          self.eventHandlers = {};
        },

        programWait(time) {
          // Synchronous sleep not recommended, no-op for fast rendering
        }
      };
    }
  };

  window.MCLocation = MCLocation;
  window.VisualModderEngine = VisualModderEngine;
})(window);
