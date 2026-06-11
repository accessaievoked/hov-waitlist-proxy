const SHOP = 'houseofvaulte';
const API_VERSION = '2024-01';

async function adminFetch(query) {
  const r = await fetch(
    `https://${SHOP}.myshopify.com/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
      },
      body: JSON.stringify({ query })
    }
  );
  return r.json();
}

export default async function handler(req, res) {
  // Allow embedding in Shopify Admin
  res.setHeader('Content-Security-Policy',
    "frame-ancestors https://houseofvaulte.myshopify.com https://admin.shopify.com;"
  );
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // Fetch all waitlist entries
  let entries = [];
  try {
    const query = `{
      metaobjects(type: "waitlist_entry", first: 250) {
        edges {
          node {
            id
            fields { key value }
          }
        }
      }
    }`;
    const data = await adminFetch(query);
    const edges = data?.data?.metaobjects?.edges || [];
    entries = edges.map(edge => {
      const obj = { _id: edge.node.id };
      edge.node.fields.forEach(f => { obj[f.key] = f.value; });
      return obj;
    });
    entries.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
  } catch (err) {
    console.error('[Dashboard]', err);
  }

  // Build stat cards by variant
  const byVariant = {};
  entries.forEach(e => {
    const k = e.variant_title || 'Unknown';
    byVariant[k] = (byVariant[k] || 0) + 1;
  });
  const statCards = Object.entries(byVariant)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `
      <div class="stat-card">
        <div class="stat-count">${count}</div>
        <div class="stat-label">${esc(label)}</div>
      </div>
    `).join('');

  // Build table rows
  const rows = entries.map((e, i) => {
    const dt = e.submitted_at
      ? new Date(e.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const waNum = (e.whatsapp || '').replace('+', '');
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(dt)}</td>
        <td>${esc(e.name || '')}</td>
        <td><a href="mailto:${esc(e.email || '')}">${esc(e.email || '')}</a></td>
        <td><a href="https://wa.me/${esc(waNum)}" target="_blank">+${esc(waNum)}</a></td>
        <td>${esc(e.product_title || '')}</td>
        <td><span class="badge">${esc(e.variant_title || '')}</span></td>
      </tr>`;
  }).join('');

  const variantOptions = Object.keys(byVariant).sort()
    .map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waitlist Dashboard — House of Vaulte</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      color: #1a1a2e;
      font-size: 13px;
    }

    .topbar {
      background: #fff;
      border-bottom: 1px solid #e3e5e8;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .topbar__left { display: flex; align-items: center; gap: 10px; }

    .topbar__logo {
      width: 28px; height: 28px;
      background: #111;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border-radius: 6px;
      letter-spacing: -0.5px;
    }

    .topbar__title { font-size: 15px; font-weight: 600; color: #111; }
    .topbar__sub { font-size: 11px; color: #888; margin-top: 1px; }

    .topbar__actions { display: flex; gap: 8px; }

    .btn {
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid #c9cccf;
      background: #232C3E;
      color: #FFF;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .btn:hover { background: #232C3E; }
    .btn--primary { background: #232C3E; color: #fff; border-color: #111; }
    .btn--primary:hover { background: #232C3E; }

    .container { padding: 20px 24px; max-width: 1200px; }

    .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }

    .stat-card {
      background: #fff;
      border: 1px solid #e3e5e8;
      border-radius: 8px;
      padding: 16px 20px;
      min-width: 130px;
      flex: 1 1 130px;
    }
    .stat-count { font-size: 26px; font-weight: 700; line-height: 1; color: #111; }
    .stat-label { font-size: 11px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }

    .total-badge {
      background: #fff;
      border: 1px solid #e3e5e8;
      border-radius: 8px;
      padding: 16px 20px;
      min-width: 130px;
      flex: 0 0 auto;
    }
    .total-badge .stat-count { color: #6366f1; }

    .card {
      background: #fff;
      border: 1px solid #e3e5e8;
      border-radius: 8px;
      overflow: hidden;
    }

    .card-header {
      padding: 14px 16px;
      border-bottom: 1px solid #e3e5e8;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .filter-select, .search-input {
      border: 1px solid #c9cccf;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      outline: none;
      background: #fff;
      color: #333;
    }
    .filter-select:focus, .search-input:focus { border-color: #6366f1; }
    .search-input { min-width: 200px; }

    .filter-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }

    table { width: 100%; border-collapse: collapse; }

    th {
      text-align: left;
      padding: 10px 14px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #888;
      border-bottom: 1px solid #e3e5e8;
      white-space: nowrap;
      background: #fafbfc;
    }

    td {
      padding: 11px 14px;
      border-bottom: 1px solid #f1f2f4;
      color: #333;
      vertical-align: middle;
    }

    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #fafbfc; }

    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      background: #f1f2f4;
      border-radius: 4px;
      font-size: 11px;
      color: #555;
      white-space: nowrap;
    }

    .empty {
      text-align: center;
      padding: 48px;
      color: #aaa;
      font-size: 13px;
    }

    .count-pill {
      display: inline-block;
      background: #f1f2f4;
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 11px;
      color: #666;
      margin-left: 4px;
    }
  </style>
</head>
<body>

<div class="topbar">
  <div class="topbar__left">
    <div>
      <div class="topbar__title">Waitlist Dashboard</div>
      <div class="topbar__sub">House of Vaulte · ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}</div>
    </div>
  </div>
  <div class="topbar__actions">
    <button class="btn btn--primary" onclick="exportCSV()">↓ Export CSV</button>
    <button class="btn" onclick="location.reload()">↻ Refresh</button>
  </div>
</div>

<div class="container">

  ${statCards ? `<div class="stats">${statCards}</div>` : ''}

  <div class="card">
    <div class="card-header">
      <span class="filter-label">Colour</span>
      <select class="filter-select" id="filter-variant" onchange="applyFilters()">
        <option value="">All Variants</option>
        ${variantOptions}
      </select>
      <input
        type="search"
        class="search-input"
        id="search-input"
        placeholder="Search name, email, number…"
        oninput="applyFilters()"
      >
      <span class="count-pill" id="count-pill">${entries.length} results</span>
    </div>

    <div style="overflow-x:auto;">
      <table id="wl-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date (IST)</th>
            <th>Name</th>
            <th>Email</th>
            <th>WhatsApp</th>
            <th>Product</th>
            <th>Colour / Variant</th>
          </tr>
        </thead>
        <tbody id="wl-tbody">
          ${rows || '<tr><td colspan="7" class="empty">No entries yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

</div>

<script>
  var allRows = ${JSON.stringify(entries)};

  function applyFilters() {
    var variant = document.getElementById('filter-variant').value;
    var search  = document.getElementById('search-input').value.toLowerCase();
    var filtered = allRows.filter(function(e) {
      var matchV = !variant || e.variant_title === variant;
      var matchS = !search || ((e.name||'')+(e.email||'')+(e.whatsapp||'')).toLowerCase().includes(search);
      return matchV && matchS;
    });
    document.getElementById('count-pill').textContent = filtered.length + ' results';
    var tbody = document.getElementById('wl-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No entries found.</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function(e, i) {
      var dt = e.submitted_at
        ? new Date(e.submitted_at).toLocaleString('en-IN', {timeZone:'Asia/Kolkata',dateStyle:'short',timeStyle:'short'})
        : '—';
      var waNum = (e.whatsapp||'').replace('+','');
      return '<tr>'
        + '<td>' + (i+1) + '</td>'
        + '<td>' + dt + '</td>'
        + '<td>' + (e.name||'') + '</td>'
        + '<td><a href="mailto:' + (e.email||'') + '">' + (e.email||'') + '</a></td>'
        + '<td><a href="https://wa.me/' + waNum + '" target="_blank">+' + waNum + '</a></td>'
        + '<td>' + (e.product_title||'') + '</td>'
        + '<td><span class="badge">' + (e.variant_title||'') + '</span></td>'
        + '</tr>';
    }).join('');
  }

  function exportCSV() {
    var variant = document.getElementById('filter-variant').value;
    var search  = document.getElementById('search-input').value.toLowerCase();
    var rows = allRows.filter(function(e) {
      var matchV = !variant || e.variant_title === variant;
      var matchS = !search || ((e.name||'')+(e.email||'')+(e.whatsapp||'')).toLowerCase().includes(search);
      return matchV && matchS;
    });
    var lines = [['#','Date (IST)','Name','Email','WhatsApp','Product','Variant'].join(',')];
    rows.forEach(function(e, i) {
      var dt = e.submitted_at ? new Date(e.submitted_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) : '';
      lines.push([i+1,q(dt),q(e.name),q(e.email),q(e.whatsapp),q(e.product_title),q(e.variant_title)].join(','));
    });
    var blob = new Blob([lines.join('\\n')], {type:'text/csv'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hov-waitlist-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
  }

  function q(s){ s=String(s||''); return '"'+s.replace(/"/g,'""')+'"'; }
</script>

</body>
</html>`;

  res.status(200).send(html);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
