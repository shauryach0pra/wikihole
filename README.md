<div align="center">

### WikiHole

</div>

<div align="center">

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](#) [![HTML](https://img.shields.io/badge/HTML-%23E34F26.svg?logo=html5&logoColor=white)](#) [![CSS](https://img.shields.io/badge/CSS-639?logo=css&logoColor=fff)](#)

</div>

---

### Overview

WikiHole is an interactive knowledge exploration tool that reveals surprising connections between topics. Enter any subject and watch it branch into unexpected related concepts through an AI-powered knowledge graph. The app features two modes: Explore for branching discoveries and Bridge for finding hidden paths between seemingly unrelated ideas. Built with vanilla JavaScript, it uses physics-based visualization and a sleek space-themed interface to make learning feel like falling down a rabbit hole.

---

### Usage

Start a local HTTP server in the project directory:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

Alternatively, use Node.js:

```bash
npx http-server -p 8000
```

---

### Tech Stack

- **Vanilla JavaScript** - Core application logic with physics simulation and custom cursor effects
- **HTML5/CSS3** - Semantic structure with animated starfield background and glass-morphism UI
- **Cloudflare Workers** - API proxy for secure AI model integration without exposing credentials
- **AI Integration** - Uses GPT-OSS-20B model for generating knowledge connections with retry logic for rate limiting

---

### Configuration

The app connects to an AI model via a Cloudflare Worker proxy to keep API keys secure. Update the Worker URL in `groq.js`:

```javascript
const GROQ = {
  url: 'https://your-worker-url.workers.dev',
  model: 'openai/gpt-oss-20b',
  // ...
};
```

The Worker should inject the API key server-side and forward requests to the AI provider. The system prompt and model parameters can be customized in the same file to adjust the tone and response style.

---

<div align="center">

Built by [Shaurya Chopra](https://shauryachopra.dev/)

</div>
