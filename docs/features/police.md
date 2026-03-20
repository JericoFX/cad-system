# Police Operations

Arrest processing, jail transfers, fines, BOLOs, and warrants.

## Arrest System

### Arrest Wizard

Step-by-step arrest processing:

1. Select the person (from search or manual entry)
2. Add charges from the fine catalog
3. Set jail time
4. Create associated case (optional)
5. Process jail transfer

### Jail Transfers

```lua
exports['cad-system']:LogJailTransfer(source, {
    personId = 'citizenid',
    personName = 'John Doe',
    jailMonths = 12,
    charges = { 'Robbery', 'Assault' },
    caseId = 'CASE-001',
})
```

Transfers are logged to the database and attached as case notes.

## Fines & Citations

### Fine Catalog

Defined in `shared/catalogs/fines.lua`. Each fine has:
- Code (e.g., `TC-101`)
- Description
- Base amount
- Category

### Issuing Fines

Via terminal command or FineManager modal:

```
> fine issue "John Doe" --code TC-101 --amount 500
> fine list
> fine search "speeding"
```

### Custom Codes

Controlled by `CAD.Config.Fines.AllowCustomCode`. When `false`, only catalog codes are allowed.

## BOLOs (Be On the Lookout)

Create and manage BOLOs via the BoloManager modal:
- Person BOLOs with description and photo
- Vehicle BOLOs with plate and model
- Active/resolved status tracking

## Warrants

Manage active warrants through the PoliceDashboard:
- Create warrants linked to cases
- Track warrant status
- Attach to arrest processing

## Police Dashboard

The PoliceDashboard modal provides:
- Active BOLOs
- Active warrants
- Recent jail transfers
- Unit deployment overview
- Impound records
