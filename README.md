# Prime Trade Exchange — FBA Shipment Tracker

Daily report tool for tracking Amazon FBA shipments: what was sent, what was received, and where the discrepancies are.

## How to Export CSV from Amazon

1. Go to [Amazon Seller Central > FBA Shipping Queue](https://sellercentral.amazon.com/gp/ssof/shipping-queue.html)
2. Click **"Export table data"** (top-right of the shipment table)
3. Save the `.csv` file to your computer

## How to Use

1. Open the app
2. Drag and drop your CSV file onto the upload area (or click to browse)
3. The daily report loads automatically for today's date
4. Use the date picker or quick filters (Today / Yesterday / Last 7 Days) to navigate
5. Click **Export Report** to download a CSV of discrepancies for escalation

## Reading the Report

- **Shipped**: Shipments created on the selected date
- **Received**: Shipments with status updates (Receiving/Closed/Delivered) on the selected date
- **Discrepancies**: Shipments where Amazon received fewer units than expected
  - Green badge = 0 units short (all good)
  - Yellow badge = 1-5 units short (minor)
  - Red badge = 6+ units short (escalate)

## Development

```bash
npm install
npm run dev
```

## Build for Deployment

```bash
npm run build
```

The `dist/` folder is ready for Netlify, Vercel, or any static host.

## Tech Stack

- React + TypeScript (Vite)
- TailwindCSS
- PapaParse (CSV parsing)
- date-fns (date utilities)
- lucide-react (icons)
- No backend — all data stays in your browser (localStorage)
