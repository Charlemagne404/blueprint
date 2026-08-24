# Blueprint release evidence packet

Copy this file into the private release record for each candidate release. Do not put
credentials, session cookies, access tokens, private Discord content, or unredacted provider
responses in the packet.

## Release identity

- Release/tag:
- Commit SHA:
- Release date (UTC):
- Reviewer(s):
- Deployment URL:
- Previous known-good SHA:

## Clean-checkout verification

```text
npm ci:
npm run check:syntax:
npm run check:secrets:
npm test:
npm audit --omit=dev --audit-level=high:
npm run check:production-config:
git diff --check:
```

## Runtime evidence

- `/healthz` response:
- `/readyz` response:
- `/metrics` scrape timestamp (token redacted):
- Process supervisor status:
- Gateway login and slash-command registration:
- Public HTTPS/security-header check:
- Browser/mobile/accessibility review:

## Discord acceptance

- Fresh disposable server:
- Customized-permissions server:
- Installation/invite permissions inspected:
- Dashboard access revocation:
- Module matrix report:
- AI access policy decision:

## Data recovery

- Backup timestamp:
- Backup location/region:
- Encryption/key owner:
- Backup manifest/checksum:
- Isolated restore result:
- Restored-data verification:
- Measured RPO:
- Measured RTO:

## Security, privacy, and operations

- Focused security review:
- Secret rotation status:
- Privacy/legal approval:
- Monitoring/alert links:
- Incident tabletop date and participants:
- Support/on-call owner:
- Accepted risks, owner, mitigation, and expiry:

## Final decision

- Decision: `GO` / `NO-GO`
- Decision date:
- Decision makers:
- Follow-up owner and due date:
