# Claude Code Agent Integration - Credential Management

This guide covers security best practices for managing API keys and sensitive data when instrumenting Claude Code agents with LangWatch.

## Table of Contents

- [API Key Management](#api-key-management)
- [Data Redaction](#data-redaction)
- [Environment Configuration](#environment-configuration)
- [Security Best Practices](#security-best-practices)

## API Key Management

### Getting Your API Key

1. Log in to [LangWatch Dashboard](https://app.langwatch.ai)
2. Navigate to **Settings** → **API Keys**
3. Click **Create API Key**
4. Copy the key (starts with `lw_`)
5. Store securely - it won't be shown again

### Setting the API Key

#### Method 1: Environment Variable (Recommended)

The most secure method is using environment variables:

```bash
# Set in your shell
export LANGWATCH_API_KEY=lw_your_api_key_here

# Or in .env file
LANGWATCH_API_KEY=lw_your_api_key_here
```

Then in your code:

```typescript
import { setupObservability } from "langwatch/observability/node";

// Automatically reads from LANGWATCH_API_KEY environment variable
await setupObservability({
  serviceName: "my-agent"
});
```

#### Method 2: Explicit Configuration

For cases where environment variables aren't suitable:

```typescript
import { setupObservability } from "langwatch/observability/node";

await setupObservability({
  apiKey: process.env.LANGWATCH_API_KEY, // Still use env var
  serviceName: "my-agent"
});
```

**⚠️ Never hardcode API keys:**

```typescript
// ❌ NEVER DO THIS
await setupObservability({
  apiKey: "lw_abc123...", // Hardcoded key - security risk!
  serviceName: "my-agent"
});
```

### API Key Rotation

Rotate API keys regularly for security:

1. **Create new API key** in LangWatch Dashboard
2. **Update environment variable** with new key
3. **Deploy updated configuration**
4. **Verify new key works**
5. **Revoke old key** in dashboard

**Zero-downtime rotation:**

```typescript
// Support multiple API keys during rotation
const apiKey = process.env.LANGWATCH_API_KEY_NEW || process.env.LANGWATCH_API_KEY;

await setupObservability({
  apiKey,
  serviceName: "my-agent"
});
```

### API Key Permissions

LangWatch API keys support different permission levels:

| Permission | Description | Use Case |
|------------|-------------|----------|
| **Read Traces** | View traces and analytics | Monitoring dashboards |
| **Write Traces** | Send traces to LangWatch | Agent instrumentation |
| **Manage Prompts** | Create/update prompts | Prompt management |
| **Admin** | Full access | Development/testing |

**Best Practice:** Use keys with minimal required permissions:

```typescript
// Production agent - Write Traces only
LANGWATCH_API_KEY=lw_write_only_key

// Monitoring dashboard - Read Traces only
LANGWATCH_API_KEY=lw_read_only_key
```

## Data Redaction

### Automatic Redaction

LangWatch automatically redacts sensitive data:

#### 1. Authorization Headers

```typescript
// Automatically redacted in HTTP request spans
const response = await fetch("https://api.example.com", {
  headers: {
    "Authorization": "Bearer secret-token", // Redacted automatically
    "X-API-Key": "secret-key"              // Redacted automatically
  }
});
```

#### 2. API Keys in URLs

```typescript
// API keys in query parameters are redacted
const url = "https://api.example.com?api_key=secret"; // Redacted
```

### Custom Redaction Rules

Add custom redaction patterns:

```typescript
import { setupObservability } from "langwatch/observability/node";

await setupObservability({
  serviceName: "my-agent",
  redactionRules: [
    {
      pattern: /password["\s:=]+([^"\s,}]+)/gi,
      replacement: "password: [REDACTED]"
    },
    {
      pattern: /ssn["\s:=]+(\d{3}-\d{2}-\d{4})/gi,
      replacement: "ssn: [REDACTED]"
    },
    {
      pattern: /credit_card["\s:=]+(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/gi,
      replacement: "credit_card: [REDACTED]"
    }
  ]
});
```

### Manual Redaction

Redact sensitive data before capturing:

```typescript
import { getLangWatchTracer } from "langwatch";

const tracer = getLangWatchTracer("my-agent");

await tracer.withActiveSpan("process-user-data", async (span) => {
  const userData = {
    name: "John Doe",
    email: "john@example.com",
    ssn: "123-45-6789",
    creditCard: "4111-1111-1111-1111"
  };
  
  // Redact before capturing
  const redactedData = {
    name: userData.name,
    email: userData.email,
    ssn: "[REDACTED]",
    creditCard: "[REDACTED]"
  };
  
  span.setInput(redactedData);
  
  // Process with original data
  const result = await processUserData(userData);
  
  // Redact output too
  span.setOutput({
    success: true,
    userId: result.userId
    // Don't include sensitive fields
  });
});
```

### Disable Input/Output Capture

For highly sensitive operations, disable capture entirely:

```typescript
await setupObservability({
  serviceName: "my-agent",
  captureInput: false,  // Don't capture inputs
  captureOutput: false  // Don't capture outputs
});
```

Or selectively:

```typescript
await tracer.withActiveSpan("sensitive-operation", async (span) => {
  // Don't set input/output for sensitive operations
  const result = await processSensitiveData(data);
  
  // Only capture metadata
  span.setAttribute("operation.type", "sensitive");
  span.setAttribute("operation.success", true);
  
  return result;
});
```

## Environment Configuration

### Development Environment

**.env.development:**
```bash
# LangWatch
LANGWATCH_API_KEY=lw_dev_key_here
LANGWATCH_ENDPOINT=https://app.langwatch.ai/api/otel/v1/traces

# Claude
ANTHROPIC_API_KEY=sk-ant-dev-key-here

# Enable debug logging
LANGWATCH_LOG_LEVEL=debug
```

### Production Environment

**.env.production:**
```bash
# LangWatch
LANGWATCH_API_KEY=lw_prod_key_here
LANGWATCH_ENDPOINT=https://app.langwatch.ai/api/otel/v1/traces

# Claude
ANTHROPIC_API_KEY=sk-ant-prod-key-here

# Disable debug logging
LANGWATCH_LOG_LEVEL=info

# Enable sampling
LANGWATCH_SAMPLING_RATE=0.1
```

### Environment-Specific Configuration

```typescript
import { setupObservability } from "langwatch/observability/node";

const isDevelopment = process.env.NODE_ENV === "development";

await setupObservability({
  serviceName: "my-agent",
  apiKey: process.env.LANGWATCH_API_KEY,
  
  // Development: capture everything
  captureInput: isDevelopment,
  captureOutput: isDevelopment,
  samplingRate: isDevelopment ? 1.0 : 0.1,
  
  // Production: more restrictive
  redactionRules: isDevelopment ? [] : [
    // Add production redaction rules
  ]
});
```

### Docker Configuration

**Dockerfile:**
```dockerfile
FROM node:18

WORKDIR /app

# Copy application
COPY package*.json ./
RUN npm install
COPY . .

# Don't include .env in image
# API keys should be provided at runtime
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  agent:
    build: .
    environment:
      - LANGWATCH_API_KEY=${LANGWATCH_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NODE_ENV=production
    env_file:
      - .env.production
```

**Run with secrets:**
```bash
# Pass secrets at runtime
docker run \
  -e LANGWATCH_API_KEY=$LANGWATCH_API_KEY \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  my-agent
```

### Kubernetes Configuration

**secrets.yaml:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: agent-secrets
type: Opaque
stringData:
  langwatch-api-key: lw_your_key_here
  anthropic-api-key: sk-ant-your-key-here
```

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claude-agent
spec:
  template:
    spec:
      containers:
      - name: agent
        image: my-agent:latest
        env:
        - name: LANGWATCH_API_KEY
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: langwatch-api-key
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: anthropic-api-key
```

## Security Best Practices

### 1. Never Commit Secrets

**Add to .gitignore:**
```gitignore
# Environment files
.env
.env.local
.env.*.local
.env.production

# API keys
**/api-keys.txt
**/secrets.json
```

**Check for leaked secrets:**
```bash
# Use git-secrets or similar tools
git secrets --scan

# Or manually search
git log -p | grep -i "lw_"
```

### 2. Use Secret Management Services

#### AWS Secrets Manager

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function getApiKey(): Promise<string> {
  const client = new SecretsManagerClient({ region: "us-east-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: "langwatch-api-key" })
  );
  return response.SecretString!;
}

// Use in setup
const apiKey = await getApiKey();
await setupObservability({
  apiKey,
  serviceName: "my-agent"
});
```

#### HashiCorp Vault

```typescript
import vault from "node-vault";

async function getApiKey(): Promise<string> {
  const client = vault({
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN
  });
  
  const result = await client.read("secret/data/langwatch");
  return result.data.data.api_key;
}
```

#### Google Secret Manager

```typescript
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

async function getApiKey(): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: "projects/my-project/secrets/langwatch-api-key/versions/latest"
  });
  return version.payload!.data!.toString();
}
```

### 3. Implement Key Validation

```typescript
function validateApiKey(apiKey: string): boolean {
  // Check format
  if (!apiKey.startsWith("lw_")) {
    throw new Error("Invalid API key format");
  }
  
  // Check length
  if (apiKey.length < 40) {
    throw new Error("API key too short");
  }
  
  return true;
}

// Use before setup
const apiKey = process.env.LANGWATCH_API_KEY;
if (!apiKey) {
  throw new Error("LANGWATCH_API_KEY not set");
}

validateApiKey(apiKey);

await setupObservability({
  apiKey,
  serviceName: "my-agent"
});
```

### 4. Monitor API Key Usage

```typescript
// Log API key usage (without exposing the key)
const apiKey = process.env.LANGWATCH_API_KEY;
const keyPrefix = apiKey?.substring(0, 7); // "lw_abc"
const keySuffix = apiKey?.substring(apiKey.length - 4); // "xyz"

console.log(`Using API key: ${keyPrefix}...${keySuffix}`);
```

### 5. Implement Rate Limiting

```typescript
// Prevent API key abuse
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each key to 100 requests per window
});

app.use("/api/", limiter);
```

### 6. Audit Logging

```typescript
// Log all API key operations
import { setupObservability } from "langwatch/observability/node";

const apiKey = process.env.LANGWATCH_API_KEY;

// Audit log
console.log({
  timestamp: new Date().toISOString(),
  action: "setup_observability",
  service: "my-agent",
  keyUsed: apiKey?.substring(0, 7) + "...",
  environment: process.env.NODE_ENV
});

await setupObservability({
  apiKey,
  serviceName: "my-agent"
});
```

## Compliance Considerations

### GDPR Compliance

```typescript
// Don't capture PII without consent
await setupObservability({
  serviceName: "my-agent",
  redactionRules: [
    // Redact email addresses
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL]" },
    // Redact phone numbers
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: "[PHONE]" },
    // Redact names (if identifiable)
    { pattern: /\b(name|username)["\s:=]+([^"\s,}]+)/gi, replacement: "$1: [REDACTED]" }
  ]
});
```

### HIPAA Compliance

```typescript
// Don't capture PHI
await setupObservability({
  serviceName: "healthcare-agent",
  captureInput: false,  // Don't capture patient data
  captureOutput: false, // Don't capture diagnoses
  
  // Only capture metadata
  customMetadata: {
    environment: "hipaa-compliant",
    dataClassification: "phi"
  }
});
```

### PCI DSS Compliance

```typescript
// Never capture payment card data
await setupObservability({
  serviceName: "payment-agent",
  redactionRules: [
    // Redact credit card numbers
    { 
      pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 
      replacement: "[CARD]" 
    },
    // Redact CVV
    { 
      pattern: /\b(cvv|cvc)["\s:=]+(\d{3,4})/gi, 
      replacement: "$1: [REDACTED]" 
    }
  ]
});
```

## Troubleshooting

### Issue: API Key Not Found

```typescript
// Check if API key is set
if (!process.env.LANGWATCH_API_KEY) {
  console.error("LANGWATCH_API_KEY environment variable not set");
  console.error("Set it with: export LANGWATCH_API_KEY=lw_your_key_here");
  process.exit(1);
}
```

### Issue: Invalid API Key

```typescript
// Validate API key format
const apiKey = process.env.LANGWATCH_API_KEY;

if (!apiKey?.startsWith("lw_")) {
  console.error("Invalid API key format. Key should start with 'lw_'");
  process.exit(1);
}
```

### Issue: Sensitive Data Leaked

If sensitive data was accidentally captured:

1. **Revoke the API key** immediately in LangWatch Dashboard
2. **Delete affected traces** in LangWatch
3. **Update redaction rules** to prevent future leaks
4. **Rotate all potentially exposed credentials**
5. **Review audit logs** for unauthorized access

## Next Steps

- [Quickstart Guide](./CLAUDE_AGENT_QUICKSTART.md) - Get started with instrumentation
- [Troubleshooting Guide](./CLAUDE_AGENT_TROUBLESHOOTING.md) - Common issues and solutions
- [Instrumentation Patterns](./CLAUDE_AGENT_PATTERNS.md) - Best practices and patterns

## Support

- [LangWatch Documentation](https://docs.langwatch.ai)
- [Security Policy](https://github.com/langwatch/langwatch/security/policy)
- [Discord Community](https://discord.gg/kT4PhDS2gH)
- [Email Support](mailto:support@langwatch.ai)
