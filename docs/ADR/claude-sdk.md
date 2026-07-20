# Claude Agent SDK — verified API surface

**Package:** `@anthropic-ai/claude-agent-sdk`
**Version verified against:** 0.3.215
**Verified:** 20.07.2026, by reading `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`

The published docs page and a web summary disagreed on `canUseTool`'s signature.
The shipped `.d.ts` is the authority; both notes below come from it.

## Entry point

```ts
function query(_params: {
  prompt: string | AsyncIterable<SDKUserMessage>
  options?: Options
}): Query
```

`Query` is an async iterable of `SDKMessage` plus mid-stream controls
(`interrupt()`, `setModel()`, `setPermissionMode()`, `streamInput()`).
An `AsyncIterable` prompt is what gives us a persistent multi-turn chat.

## Permission callback — the load-bearing piece

```ts
type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal
    suggestions?: PermissionUpdate[]
    toolUseID: string
    requestId: string
    title?: string          // pre-rendered prompt sentence
    displayName?: string    // short label, good for buttons
    description?: string
    decisionReason?: string
    blockedPath?: string
    agentID?: string
    matchedAskRule?: { source: string; toolName: string; ruleContent?: string }
  },
) => Promise<PermissionResult | null>

type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown>
      updatedPermissions?: PermissionUpdate[] }
  | { behavior: 'deny'; message: string; interrupt?: boolean }
```

Two things the type comments spell out and we must respect:

1. **Never return `null`.** It means "I already answered out-of-band". Returning
   it by accident leaves the tool blocked forever — the doc comment says
   permission prompts have no park deadline. Our bridge always resolves to an
   explicit allow or deny, including on error.
2. **"Always allow this session"** is implemented by echoing
   `options.suggestions` back as `updatedPermissions`, not by keeping our own
   allow-list.

## Custom tools

```ts
function tool<Schema extends AnyZodRawShape>(
  name: string, description: string, inputSchema: Schema,
  handler: (args, extra) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations; searchHint?: string; alwaysLoad?: boolean },
): SdkMcpToolDefinition<Schema>

function createSdkMcpServer(options: {
  name: string; version?: string; tools?: SdkMcpToolDefinition<any>[]
}): McpSdkServerConfigWithInstance
```

Schemas are zod raw shapes. Handlers run **in our process**, which is what lets
them execute over the SSH connection.

## The fact that shapes the whole design

The SDK's built-in `Bash`, `Read`, `Write`, `Edit`, `Glob` and `Grep` operate on
**the machine running the SDK** — the user's Mac. Intercepting them in
`canUseTool` and approving would run them locally, which is the opposite of what
this app is for.

So they are disabled via `disallowedTools`, and Claude is given our own tools
whose handlers go through the existing SSH channels. `canUseTool` then guards
*our* tools rather than trying to redirect the SDK's.

## Runtime and packaging

- The SDK ships a per-platform prebuilt executable through
  `optionalDependencies` (`@anthropic-ai/claude-agent-sdk-darwin-arm64` here)
  and spawns it as a subprocess. It is not a node-gyp addon, so ADR 0005 still
  holds: nothing is compiled against Electron's ABI.
- It must be `asarUnpack`ed by electron-builder in phase 7, or the spawn fails
  inside the packaged app.

## Authentication constraint

The official docs state: *"Unless previously approved, Anthropic does not allow
third party developers to offer claude.ai login or rate limits for their
products, including agents built on the Claude Agent SDK. Please use the API key
authentication methods."*

Köprü therefore asks the user for their own `ANTHROPIC_API_KEY`, stored with
`safeStorage` like every other secret. A Claude subscription cannot be used.
