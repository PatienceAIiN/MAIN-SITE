import { isMissingTableError, queryDb } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const requireAdmin = (req) => verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME));

const parseDevice = (ua = '') => {
  if (/mobile|android|iphone|ipod/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
};

const parseBrowser = (ua = '') => {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
};

const hashIp = (ip) => {
  if (!ip) return null;
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = Math.imul(31, h) + ip.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36);
};

export default async function analyticsHandler(req, res) {
  if (req.method === 'POST') {
    const { page, referrer, session_id } = req.body || {};
    if (!page) return res.status(400).json({ error: 'page required' });

    const ua = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || '';

    const ipHash = hashIp(ip);
    const deviceType = parseDevice(ua);
    const browser = parseBrowser(ua);
    const cleanPage = String(page).slice(0, 200);
    const cleanReferrer = referrer ? String(referrer).slice(0, 500) : null;
    const cleanSession = session_id ? String(session_id).slice(0, 64) : null;

    try {
      await queryDb(
        `INSERT INTO public.page_views (page, referrer, device_type, browser, session_id, ip_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [cleanPage, cleanReferrer, deviceType, browser, cleanSession, ipHash]
      );
    } catch (err) {
      if (!isMissingTableError(err.message)) {
        console.error('Analytics insert error:', err.message);
      }
    }
    return res.json({ ok: true });
  }

  if (req.method === 'GET') {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const [total, today, week, month, topPages, topRefs, devices, browsers, recent, uniqueToday, uniqueWeek, supportChats, supportChatPeople] =
        await Promise.all([
          queryDb(`SELECT COUNT(*) as c FROM public.page_views`),
          queryDb(`SELECT COUNT(*) as c FROM public.page_views WHERE created_at >= NOW() - INTERVAL '1 day'`),
          queryDb(`SELECT COUNT(*) as c FROM public.page_views WHERE created_at >= NOW() - INTERVAL '7 days'`),
          queryDb(`SELECT COUNT(*) as c FROM public.page_views WHERE created_at >= NOW() - INTERVAL '30 days'`),
          queryDb(`SELECT page, COUNT(*) as c FROM public.page_views GROUP BY page ORDER BY c DESC LIMIT 12`),
          queryDb(`SELECT referrer, COUNT(*) as c FROM public.page_views WHERE referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY c DESC LIMIT 10`),
          queryDb(`SELECT device_type, COUNT(*) as c FROM public.page_views GROUP BY device_type ORDER BY c DESC`),
          queryDb(`SELECT browser, COUNT(*) as c FROM public.page_views GROUP BY browser ORDER BY c DESC`),
          queryDb(`SELECT page, referrer, device_type, browser, created_at FROM public.page_views ORDER BY created_at DESC LIMIT 50`),
          queryDb(`SELECT COUNT(DISTINCT ip_hash) as c FROM public.page_views WHERE created_at >= NOW() - INTERVAL '1 day'`),
          queryDb(`SELECT COUNT(DISTINCT ip_hash) as c FROM public.page_views WHERE created_at >= NOW() - INTERVAL '7 days'`),
          queryDb(`SELECT COUNT(*) as c FROM public.support_chat_conversations`),
          queryDb(`SELECT conversation_id, customer_name, executive_email, status, updated_at FROM public.support_chat_conversations ORDER BY updated_at DESC LIMIT 100`)
        ]);

      return res.json({
        total: Number(total[0]?.c || 0),
        today: Number(today[0]?.c || 0),
        week: Number(week[0]?.c || 0),
        month: Number(month[0]?.c || 0),
        uniqueToday: Number(uniqueToday[0]?.c || 0),
        uniqueWeek: Number(uniqueWeek[0]?.c || 0),
        topPages: topPages.map(r => ({ page: r.page, count: Number(r.c) })),
        topReferrers: topRefs.map(r => ({ referrer: r.referrer, count: Number(r.c) })),
        devices: devices.map(r => ({ device: r.device_type, count: Number(r.c) })),
        browsers: browsers.map(r => ({ browser: r.browser, count: Number(r.c) })),
        recent: recent,
        support: {
          totalChats: Number(supportChats[0]?.c || 0),
          items: supportChatPeople.map((item) => ({
            conversationId: item.conversation_id,
            customerName: item.customer_name || 'Unknown',
            executiveEmail: item.executive_email || 'Unassigned',
            status: item.status,
            updatedAt: item.updated_at
          }))
        }
      });
    } catch (err) {
      if (isMissingTableError(err.message)) {
        return res.json({ total: 0, today: 0, week: 0, month: 0, uniqueToday: 0, uniqueWeek: 0, topPages: [], topReferrers: [], devices: [], browsers: [], recent: [], support: { totalChats: 0, items: [] } });
      }
      console.error('Analytics GET error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
