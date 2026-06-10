const SHOP = 'houseofvaulte';
const API_VERSION = '2024-01';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://houseofvaulte.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function adminFetch(query, variables = {}) {
  const r = await fetch(
    `https://${SHOP}.myshopify.com/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({ query, variables })
    }
  );
  return r.json();
}

// ── POST — save a new waitlist entry ─────────────────────────────────────────
async function handlePost(req, res) {
  let body = '';
  if (typeof req.body === 'object') {
    body = req.body;
  } else {
    body = JSON.parse(req.body || '{}');
  }

  const { name, email, whatsapp, variant_id, variant_title, product_id, product_title } = body;

  if (!name || !email || !whatsapp || !variant_title) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const mutation = `
    mutation CreateWaitlistEntry($fields: [MetaobjectFieldInput!]!) {
      metaobjectCreate(metaobject: {
        type: "waitlist_entry",
        fields: $fields
      }) {
        metaobject { id handle }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    fields: [
      { key: 'name',          value: name },
      { key: 'email',         value: email },
      { key: 'whatsapp',      value: whatsapp },
      { key: 'variant_id',    value: String(variant_id || '') },
      { key: 'variant_title', value: variant_title },
      { key: 'product_id',    value: String(product_id || '') },
      { key: 'product_title', value: product_title || '' },
      { key: 'submitted_at',  value: new Date().toISOString() }
    ]
  };

  const data = await adminFetch(mutation, variables);

  if (data.errors || (data.data?.metaobjectCreate?.userErrors?.length > 0)) {
    const err = data.errors?.[0]?.message || data.data?.metaobjectCreate?.userErrors?.[0]?.message;
    console.error('[Waitlist] Save error:', err);
    return res.status(500).json({ ok: false, error: err });
  }

  return res.status(200).json({ ok: true, id: data.data.metaobjectCreate.metaobject.id });
}

// ── GET — fetch all waitlist entries ─────────────────────────────────────────
async function handleGet(req, res) {
  // Simple PIN check
  const pin = req.query.pin;
  if (pin !== process.env.DASHBOARD_PIN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const query = `{
    metaobjects(type: "waitlist_entry", first: 250, sortKey: UPDATED_AT) {
      edges {
        node {
          id
          fields { key value }
        }
      }
    }
  }`;

  const data = await adminFetch(query);

  if (data.errors) {
    return res.status(500).json({ ok: false, error: data.errors[0].message });
  }

  const entries = (data.data?.metaobjects?.edges || []).map(edge => {
    const obj = { _id: edge.node.id };
    edge.node.fields.forEach(f => { obj[f.key] = f.value; });
    return obj;
  });

  // Sort newest first
  entries.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));

  return res.status(200).json({ ok: true, entries });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') return await handlePost(req, res);
    if (req.method === 'GET')  return await handleGet(req, res);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[Waitlist] Unhandled error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
