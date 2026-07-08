import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function generate() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const svgPath = path.resolve("public/moniq-mark.svg");
  const svgContent = fs.readFileSync(svgPath, "utf8");
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100vw;
            height: 100vh;
          }
          svg {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `;
  
  await page.setContent(htmlContent);
  
  const targets = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
  ];
  
  for (const target of targets) {
    await page.setViewportSize({ width: target.size, height: target.size });
    await page.screenshot({
      path: path.join("public", target.name),
      omitBackground: true,
      type: "png",
    });
    console.log(`Generated public/${target.name} (${target.size}x${target.size})`);
  }
  
  // Generate maskable icon (opaque background is mandatory for maskable)
  await page.setViewportSize({ width: 512, height: 512 });
  await page.screenshot({
    path: path.join("public", "icon-maskable-512.png"),
    omitBackground: false,
    type: "png",
  });
  console.log("Generated public/icon-maskable-512.png (512x512)");
  
  await browser.close();
}

generate().catch(console.error);
