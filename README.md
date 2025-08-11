# 청렴 챗봇 서버 (Typebot 연동용, Vercel 배포)

## 1) 환경변수
- `OPENAI_API_KEY`: OpenAI API 키
- `SERVER_KEY`: Typebot에서 Authorization 헤더로 보낼 임의 문자열

`.env.example`를 참고해서 Vercel의 Project Settings → Environment Variables에 등록하세요.

## 2) 배포
- GitHub에 푸시 후 Vercel에서 Import → Deploy
- 엔드포인트: `https://<project>.vercel.app/api/ask`

## 3) Typebot HTTP Request 설정
- URL: 위 엔드포인트
- Method: POST
- Headers: `Authorization: Bearer {{server_key}}`
- Body(JSON):
```
{
  "flow": "{{flow}}",
  "user_input": "{{q}}",
  "history": {{history_json}}
}
```
