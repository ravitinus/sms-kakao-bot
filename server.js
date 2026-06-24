const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

let currentAccessToken = process.env.KAKAO_ACCESS_TOKEN;
let currentRefreshToken = process.env.KAKAO_REFRESH_TOKEN;

async function refreshAccessToken() {
  try {
    const res = await axios.post('https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: KAKAO_REST_API_KEY,
        refresh_token: currentRefreshToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    currentAccessToken = res.data.access_token;
    if (res.data.refresh_token) {
      currentRefreshToken = res.data.refresh_token;
    }
    console.log('✅ 토큰 갱신 성공');
  } catch (e) {
    console.error('❌ 토큰 갱신 실패:', e.message);
  }
}

async function sendKakaoMessage(text) {
  try {
    const res = await axios.post(
      'https://kapi.kakao.com/v2/api/talk/memo/default/send',
      new URLSearchParams({
        template_object: JSON.stringify({
          object_type: 'text',
          text: text,
          link: { web_url: 'https://kakao.com' },
        }),
      }),
      {
        headers: {
          Authorization: `Bearer ${currentAccessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log('✅ 카카오 메시지 전송 성공');
    return res.data;
  } catch (e) {
    if (e.response?.data?.code === -401) {
      console.log('🔄 토큰 만료 - 갱신 시도');
      await refreshAccessToken();
      return sendKakaoMessage(text);
    }
    console.error('❌ 메시지 전송 실패:', e.response?.data || e.message);
    throw e;
  }
}

// Android에서 호출할 Webhook
app.post('/sms-webhook', async (req, res) => {
  const { secret, sender, message } = req.body;

  if (secret !== SECRET_KEY) {
    return res.status(403).json({ error: '인증 실패' });
  }
  if (!sender || !message) {
    return res.status(400).json({ error: '파라미터 누락' });
  }

  const text = `📱 SMS 수신 알림\n발신번호: ${sender}\n내용: ${message}\n시간: ${new Date().toLocaleString('ko-KR')}`;

  try {
    await sendKakaoMessage(text);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '메시지 전송 실패' });
  }
});

// 헬스체크
app.get('/', (req, res) => res.send('SMS Bot Server Running ✅'));

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 서버 시작됨');
});
