# 11. System Architecture

Detailed system architecture and data flows for the Patience AI platform.

## High-Level System Architecture

```mermaid
graph TD
    %% Clients
    User([User Browser])
    Admin([Admin / Support Executive Console])

    %% Frontend Gateways
    subgraph Frontend [Client Layer (React 18 / Vite)]
        ReactApp["React SPA (React Router 7, Framer Motion)"]
        ChatWidget["Floating Chat Widget"]
        TicketPortal["Support Ticket Portal"]
    end

    User -->|HTTPS| ReactApp
    Admin -->|HTTPS Session Cookie| TicketPortal

    %% App Server
    subgraph ServerLayer [Application Layer (Render Web Service)]
        direction TB
        ExpressServer["Express.js Server (Node.js 24)"]
        PythonServices["Python AI & CRM Engines (FastAPI)"]
    end

    ReactApp -->|API Requests / Webhook| ExpressServer
    ExpressServer -->|Internal RPC / Process Call| PythonServices

    %% Infrastructure & Third Party
    subgraph Storage [Data & Storage Layer]
        NeonDB[("Neon PostgreSQL (Serverless / HTTP SQL API)")]
        R2[("Cloudflare R2 Object Storage (15-min Signed URLs)")]
        Redis[("Redis (Rate-Limiting & Cache)")]
    end

    subgraph External [Third-Party Integrations]
        Groq["Groq API (Llama-3.3-70B & Whisper)"]
        EdgeTTS["Microsoft Edge Neural TTS (Free / Offline)"]
        Brevo["Brevo HTTP API (Newsletter & Ticket Mails)"]
        SMTP["GoDaddy SMTP (Fallback Mailer)"]
        n8n["n8n Webhook Router"]
    end

    %% Data flows
    ExpressServer -->|HTTP POST Query| NeonDB
    ExpressServer -->|Read/Write Cache| Redis
    PythonServices -->|Store/Retrieve Media| R2
    
    PythonServices -->|Transcription & Reasoning| Groq
    PythonServices -->|Neural Synthesis| EdgeTTS
    ExpressServer -->|Mail Campaigns| Brevo
    ExpressServer -->|System Emails| SMTP
    PythonServices -->|Webhook Triggers| n8n
```

## Modular Components & Services

### 1. Frontend Client (React)
- **Vite 5 Build System:** Bundles the application with optimized production outputs.
- **React Router 7:** Manages routing for pages, client workspaces, and executive channels.
- **Framer Motion:** Drives modern, hardware-accelerated animations and page transitions.

### 2. Primary API Gateway (Express.js)
- Runs on Node.js 24.
- Handles user authentification, session management, forms submissions, and newsletter subscriptions.
- Leverages Redis for session caches and endpoint rate limiting.

### 3. Background Services & AI Layer (Python FastAPI)
- Handles LLM integrations via Groq (Llama-3.3-70B and Whisper).
- Orchestrates multi-lingual translation pipelines (English to Hindi).
- Manages audio processing via bundled `ffmpeg` and local Edge TTS synthesizers.
- Drives vector memory indexing, business context routing, and lead qualification engines.

### 4. Storage & Persistence
- **Neon Serverless PostgreSQL:** Relational database querying via non-persistent HTTP endpoints.
- **Cloudflare R2:** S3-compatible object storage serving asset files through secure, short-lived (15-minute) signed URLs.
