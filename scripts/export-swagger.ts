import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function exportSwagger() {
  const app = await NestFactory.create(AppModule, { logger: false });

  // Setup Swagger configuration (same as main.ts)
  const config = new DocumentBuilder()
    .setTitle('Solpass Ticket API')
    .setDescription('RESTful API for Solana-based ticket management')
    .setVersion('1.0')
    .addTag('Events')
    .addTag('Tickets')
    .addTag('Auth')
    .addTag('Ticket Operations')
    .addTag('Development & Testing')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Create output directory
  const outputDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Export as JSON
  const jsonPath = path.join(outputDir, 'swagger.json');
  fs.writeFileSync(jsonPath, JSON.stringify(document, null, 2));
  console.log(`✅ Swagger JSON exported to: ${jsonPath}`);

  // Export as static HTML
  const htmlPath = path.join(outputDir, 'api-docs.html');
  const html = generateSwaggerHTML(document);
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ Swagger HTML exported to: ${htmlPath}`);
  console.log(
    `\n📖 Open ${htmlPath} in your browser to view the documentation\n`,
  );

  await app.close();
  process.exit(0);
}

function generateSwaggerHTML(swaggerDoc: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solpass API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css">
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ${JSON.stringify(swaggerDoc)};
      
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true
      });
    };
  </script>
</body>
</html>`;
}

exportSwagger().catch(console.error);
