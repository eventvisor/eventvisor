# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Report it privately through GitHub Security Advisories for the `eventvisor/eventvisor` repository. Include affected versions, impact, reproduction steps, and any suggested mitigation.

## Trust model

Eventvisor datafiles are public runtime configuration, but they are trusted control input. A datafile can change validation, transformation, sampling, routing, destinations, and effect behavior without an application deployment.

Serve datafiles over TLS from infrastructure you control. Restrict who can publish them, retain review and audit history, and use cache controls that fit your rollback plan. Do not put secrets in project definitions or generated datafiles.

The Pixel module treats script execution as an explicit capability. Scripts are disabled unless `allowScripts: true` is configured in application code. Applications enabling scripts should use a restrictive Content Security Policy and pass a CSP nonce to the module. A compromised datafile origin must be treated as a potential application security incident.

Transport modules receive event payloads and attributes selected by the application. Review their destination URLs, credentials, retention, and privacy controls independently.
