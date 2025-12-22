/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "solpass-api",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const vpc = new sst.aws.Vpc("MyVpc");
    const cluster = new sst.aws.Cluster("MyCluster", { vpc });

    // Secrets for Neon DB and other sensitive data
    const secrets = {
      DB_PASSWORD: new sst.Secret("DB_PASSWORD"),
      JWT_SECRET: new sst.Secret("JWT_SECRET"),
      JWT_REFRESH_SECRET: new sst.Secret("JWT_REFRESH_SECRET"),
      SOLANA_SERVER_SECRET: new sst.Secret("SOLANA_SERVER_SECRET"),
    };

    new sst.aws.Service("MyService", {
      cluster,
      loadBalancer: {
        ports: [{ listen: "80/http", forward: "3000/http" }],
      },
      link: Object.values(secrets),
      environment: {
        NODE_ENV: "production",
        PORT: "3000",
        API_PREFIX: "api/v1",
        
        // Neon DB connection (use pooler endpoint)
        DB_HOST: "ep-sweet-dew-a4gi3579-pooler.us-east-1.aws.neon.tech",
        DB_PORT: "5432",
        DB_USERNAME: "neondb_owner",
        DB_NAME: "neondb",
        // DB_PASSWORD is linked as secret above
        
        // Solana
        SOLANA_RPC_URL: "https://api.devnet.solana.com",
        SOLANA_CLUSTER: "devnet",
        SOLANA_PROGRAM_ID: "tY21CBvTQWpVjBhziVFStkbbsYRKjNgE37j7uVSfvRr",
        
        // JWT
        JWT_EXPIRES_IN: "1h",
        JWT_REFRESH_EXPIRES_IN: "7d",
      },
      dev: {
        command: "npm run start:dev",
      },
    });
  },
});
