const base = process.argv[2] || 'http://127.0.0.1:43123';

async function api(path, body) {
  const response = await fetch(`${base}${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function appScreenSvg(index) {
  const accents = ['#007aff', '#7c3aed', '#ff375f'];
  const labels = ['Today', 'Discover', 'Profile'];
  const cards = index === 0
    ? '<rect x="34" y="182" width="292" height="172" rx="28" fill="#ffffff"/><circle cx="82" cy="231" r="25" fill="#dbeafe"/><rect x="120" y="215" width="166" height="15" rx="7" fill="#18181b"/><rect x="120" y="244" width="120" height="10" rx="5" fill="#a1a1aa"/><rect x="34" y="377" width="139" height="186" rx="28" fill="#ffffff"/><rect x="187" y="377" width="139" height="186" rx="28" fill="#ffffff"/>'
    : index === 1
      ? '<rect x="34" y="178" width="292" height="354" rx="32" fill="#ffffff"/><rect x="57" y="206" width="246" height="150" rx="24" fill="#ede9fe"/><rect x="57" y="385" width="194" height="17" rx="8" fill="#18181b"/><rect x="57" y="420" width="230" height="11" rx="5" fill="#a1a1aa"/><rect x="57" y="444" width="170" height="11" rx="5" fill="#a1a1aa"/>'
      : '<circle cx="180" cy="236" r="70" fill="#ffe4e9"/><circle cx="180" cy="226" r="31" fill="#ff8ca5"/><path d="M116 306c14-39 114-39 128 0" fill="#ff8ca5"/><rect x="50" y="346" width="260" height="58" rx="18" fill="#ffffff"/><rect x="50" y="420" width="260" height="58" rx="18" fill="#ffffff"/><rect x="50" y="494" width="260" height="58" rx="18" fill="#ffffff"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780" viewBox="0 0 360 780"><rect width="360" height="780" rx="48" fill="#f7f7fa"/><text x="34" y="72" font-family="-apple-system,sans-serif" font-size="16" font-weight="700" fill="#18181b">9:41</text><rect x="34" y="112" width="292" height="46" rx="18" fill="${accents[index]}"/><text x="54" y="143" font-family="-apple-system,sans-serif" font-size="22" font-weight="750" fill="#fff">${labels[index]}</text>${cards}<rect x="34" y="690" width="292" height="60" rx="26" fill="#ffffff"/><circle cx="91" cy="720" r="8" fill="${accents[index]}"/><circle cx="180" cy="720" r="8" fill="#d4d4d8"/><circle cx="269" cy="720" r="8" fill="#d4d4d8"/></svg>`;
}

const created = await api('/api/projects', { name: 'Lumina — App Store Story', width: 1320, height: 2868, defaultLocale: 'en-US', seed: false });
const projectId = created.project.id;
await api(`/api/projects/${projectId}/locales/bulk`, { locales: [
  { locale: 'pt-BR', label: 'Português (Brasil)' },
  { locale: 'ja-JP', label: '日本語' },
] });

const copy = [
  { name: 'Your day, beautifully clear', sub: 'Everything important, in one calm place.', emoji: '✨' },
  { name: 'Discover what moves you', sub: 'Thoughtful recommendations made personal.', emoji: '💎' },
  { name: 'Made around your rhythm', sub: 'Small details that feel unmistakably yours.', emoji: '❤️' },
];
const localized = [
  ['Seu dia, lindamente claro', 'Tudo que importa em um só lugar.', '毎日を、もっと美しく'],
  ['Descubra o que inspira você', 'Recomendações feitas para você.', '心動く発見を、あなたに'],
  ['Feito no seu ritmo', 'Detalhes que combinam com você.', 'あなたのリズムに寄り添う'],
];

for (let index = 0; index < 3; index += 1) {
  const svg = appScreenSvg(index);
  const asset = (await api('/api/assets', {
    projectId, name: `lumina-${index + 1}.svg`, kind: 'demo-screenshot',
    dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: 360, height: 780,
  })).asset;
  const screen = (await api(`/api/projects/${projectId}/screens`, {
    name: ['Daily clarity', 'Personal discovery', 'Your profile'][index], assetId: asset.id, locale: 'en-US',
    layout: { backgroundMode: 'shared', device: { frame: 'iphone', scale: 63, x: 50, y: 64, tilt: index === 0 ? -3 : index === 2 ? 3 : 0, radius: 70 } },
  })).screen;
  await api(`/api/screens/${screen.id}/layers`, {
    type: 'text', name: 'Headline', props: { y: 11.5, width: 86, fontSize: 116, fontWeight: 780, color: '#111114', lineHeight: 1.02 },
    localizations: { 'en-US': { text: copy[index].name }, 'pt-BR': { text: localized[index][0] }, 'ja-JP': { text: localized[index][2] } },
  });
  await api(`/api/screens/${screen.id}/layers`, {
    type: 'text', name: 'Supporting copy', props: { y: 21.5, width: 80, fontSize: 45, fontWeight: 500, color: '#56565e', lineHeight: 1.2 },
    localizations: { 'en-US': { text: copy[index].sub }, 'pt-BR': { text: localized[index][1] }, 'ja-JP': { text: 'あなたらしさを大切にする、小さな工夫。' } },
  });
  await api(`/api/screens/${screen.id}/layers`, {
    type: 'emoji', name: 'Favorite emoji', props: { x: index === 0 ? 89 : 11, y: index === 1 ? 48 : 42, width: 12, fontSize: 150, rotation: index === 1 ? -8 : 7 },
    localizations: { 'en-US': { text: copy[index].emoji }, 'pt-BR': { text: copy[index].emoji }, 'ja-JP': { text: copy[index].emoji } },
  });
}

console.log(JSON.stringify({ projectId, url: `${base}/?project=${projectId}&mode=canvas` }, null, 2));
