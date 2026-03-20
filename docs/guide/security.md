# Security

## Authentication

Every server callback is wrapped with `CAD.Auth.WithGuard()`:

```lua
CAD.Auth.WithGuard('default', function(source, payload, officer)
    -- officer is guaranteed valid here
    -- source is the FiveM server ID
end)
```

The guard:
1. Validates the player has an allowed job
2. Checks the officer cache (with TTL)
3. Enforces rate limits
4. Returns officer context to the handler

## Authorization

### Job-Based Access

Jobs are configured in `config.lua`:

```lua
CAD.Config.Security.AllowedJobs = {
    police = true,
    sheriff = true,
    ambulance = true,
    -- ...
}
```

### Admin Jobs

Admin jobs bypass certain restrictions:

```lua
CAD.Config.Security.AdminJobs = {
    admin = true,
    policechief = true,
}
```

## Rate Limiting

Per-source rate limiting prevents abuse:

```lua
CAD.Config.Security.RateLimitPerMinute = {
    default = 80,   -- Standard operations
    heavy = 30,     -- Resource-intensive operations
}
```

## Input Sanitization

All user input passes through `CAD.Server.SanitizeString()`:

- Strips HTML tags (`<script>`, `<img>`, etc.)
- Normalizes whitespace (newlines, tabs)
- Trims leading/trailing spaces
- Enforces maximum length

## SQL Safety

All database queries use parameterized statements via oxmysql:

```lua
-- SAFE: parameterized
MySQL.insert.await('INSERT INTO cad_cases (case_id, title) VALUES (?, ?)', { caseId, title })

-- NEVER used: string concatenation
-- MySQL.query('SELECT * FROM cases WHERE id = ' .. id)  -- UNSAFE
```

## Event Security

- Server-side validation on all operations
- Client cannot directly modify state
- NUI callbacks wrapped in pcall for crash protection
- Officer identity resolved server-side (not from client payload)

## Best Practices for Admins

1. Set `CAD_MEDIA_API_KEY` as a convar, never hardcode it
2. Keep `server.cfg` with restricted permissions (600)
3. Use the `full` profile only if you need all features
4. Review `AllowedJobs` to match your server's job system
5. Set `Debug = false` in production
