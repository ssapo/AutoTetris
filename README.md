# ChromaPeel Web

`Star001-KR/ChromaPeel`의 Python 배치 로직을 브라우저에서 실행되는 정적 웹페이지로 옮긴 버전입니다.

## 특징

- PNG 파일 업로드
- 지정한 배경색 크로마키 제거
- `Tolerance`, `Feather`, `Color Decontamination`, `Edge Erosion` 조절
- 처리 결과 미리보기
- PNG 다운로드
- 서버 없이 브라우저 내부에서 처리

## 파일 구성

- `index.html`: 화면 구조
- `styles.css`: UI 스타일
- `script.js`: 원본 `imageAlpha.py` 알고리즘을 JavaScript로 포팅한 처리 로직

## 로컬 실행

정적 파일이라 브라우저로 바로 열어도 되지만, 로컬 서버로 여는 편이 더 안전합니다.

```bash
python -m http.server 8080
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:8080
```

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소에 올립니다.
2. 저장소 `Settings > Pages`로 들어갑니다.
3. `Deploy from a branch`를 선택합니다.
4. 브랜치는 `main`, 폴더는 `/ (root)`를 선택합니다.
5. 잠시 후 `https://사용자명.github.io/저장소명/` 형태로 열립니다.

## 정적 호스팅 대안

- GitHub Pages
- Netlify
- Cloudflare Pages
- Vercel

## 원본 저장소

- [Star001-KR/ChromaPeel](https://github.com/Star001-KR/ChromaPeel)
