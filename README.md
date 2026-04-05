# ♾️ Sketch-Loop

> An AI-powered creative workflow platform, seamlessly looping ideation and real-time generation.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)

## 🚀 Features

- **Real-time AI Generation**: Integrate directly with top-tier AI models (Anthropic, Google via AI SDK) for instant sketch-to-concept workflows.
- **Robust Reactive Backend**: Built entirely on **Convex** and **Inngest** for lightning-fast state synchronization, real-time messaging, and reliable background jobs.
- **Durable Rate Limiting**: Employs **Upstash Redis** to guarantee fair usage and securely handle high-traffic prompt API requests.
- **Modern Extensible UI**: Designed using **Next.js 15**, **Tailwind CSS**, and **Radix UI** primitives for a flawless, accessible developer and user experience.

## 🏗 Architecture & Anti-Gravity Integration

Sketch-Loop pushes the boundaries of modern application architecture by integrating **Anti-Gravity** for advanced AI-driven workflows. By leveraging Anti-Gravity, the platform is able to autonomously handle complex code-generation mechanics and seamlessly spin up background resources, bridge AI generation boundaries, and manage the underlying prompt-routing systems without creating friction for the frontend.

## 🛠 Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- npm or pnpm
- A [Convex](https://www.convex.dev/) account for backend sync

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Hardik-Ashra/sketch-loop.git
   cd sketch-loop
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Variables

Ensure all necessary service integrations are authenticated. Create a `.env.local` file in the root directory and add the following keys:

```ini
# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# AI Providers
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# Auth
AUTH_SECRET=your_auth_secret
```

## 💻 Usage

To run the application locally, you will need to start both the Next.js development server and the Convex backend.

1. **Start the frontend Next.js server:**
   ```bash
   npm run dev
   ```

2. **Start the Convex backend (in a new terminal window):**
   ```bash
   npx convex dev
   ```

3. **Start the Inngest local server for background jobs (optional):**
   ```bash
   npx inngest-cli@latest dev
   ```

You can now open [http://localhost:3000](http://localhost:3000) to view the application.

## 🤝 Contributing

We welcome contributions from the community to help make Sketch-Loop even better! To contribute:

1. Fork the repository.
2. Create a new feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request detailing your changes, motivation, and any breaking changes.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
