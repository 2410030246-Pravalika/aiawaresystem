import express from "express";
import path from "path";
import dotenv from "dotenv";
import app from "./api/index";

dotenv.config();

const PORT = 3000;

// Serve frontend assets
async function setupServer() {
  // Automatically detect production if NODE_ENV is "production" or we are running a bundled script from the dist folder
  const isProduction = process.env.NODE_ENV === "production" || 
    (typeof __dirname !== "undefined" && (__dirname.includes("dist") || __dirname.endsWith("dist")));

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (process.env.VERCEL !== "1") {
  setupServer();
}
