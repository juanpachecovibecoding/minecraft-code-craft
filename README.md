# Minecraft Prismarine Bundle 1.16.5 + Entorno de Programación (Blockly)

Este proyecto contiene la versión completa y descomprimida del contenedor Docker **Minecraft + Prismarine Web Client + VisualModder (Blockly)**.

---

## 📁 Estructura del Proyecto

```
minecraft-prismarine-bundle/
├── app/
│   └── mc/
│       ├── spigot-1.16.5.jar           # Servidor Minecraft Spigot 1.16.5
│       ├── server.properties           # Configuración del servidor Minecraft
│       ├── bukkit.yml / spigot.yml     # Ajustes de Spigot y Bukkit
│       ├── plugins/                    # Plugins del servidor
│       │   ├── visualmodder-1.17.0.jar # Plugin de conexión HTTP con Blockly
│       │   └── visualmodder/           # Configuración y programas de usuario
│       ├── worlds/                     # Mundos (world, world_code, nether, end)
│       └── prismarine-web-client/      # Cliente Web de Minecraft + Backend
│           ├── server.js               # Backend Node.js Express (WebSockets + Auth + Proxy /EXE)
│           ├── package.json            # Dependencias de Node.js
│           ├── dist/                   # Frontend web compilado de Prismarine
│           │   └── blockly/            # Editor visual de programación Blockly
│           ├── public/                 # Overrides y config.json
│           ├── Dockerfile              # Definición de la imagen Docker
│           ├── docker-compose.yml      # Configuración de Docker Compose
│           ├── nginx.conf              # Configuración de NGINX Reverse Proxy
│           └── supervisord.conf        # Configuración del supervisor de procesos
└── docker-configs/                     # Copia de configs extraídos
    ├── nginx.conf
    └── supervisord.conf
```

---

## 🚀 Cómo reconstruir y levantar la imagen con Docker

Desde el directorio `app/mc/prismarine-web-client`:

```bash
docker compose up -d --build
```

O construyendo directamente desde `app/mc`:

```bash
cd app/mc
docker build -t minecraft-prismarine-bundle:custom -f prismarine-web-client/Dockerfile .
docker run -d -p 8080:80 -p 25565:25565 --name mc-bundle minecraft-prismarine-bundle:custom
```

---

## 🌐 Servicios y Puertos

* **Cliente Web (Navegador):** `http://localhost:8080/`
* **Editor Blockly (Programación):** `http://localhost:8080/blockly/`
* **Servidor Minecraft (Launcher Java):** `localhost:25565`
