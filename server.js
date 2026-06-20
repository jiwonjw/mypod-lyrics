const express = require('express');
const cors = require('cors');
const Genius = require('genius-lyrics');

const app = express();
app.use(express.static(__dirname));
app.use(cors()); 

const Client = new Genius.Client();

// 🌟 여기부터 복사해서 기존 app.get('/api/lyrics', ...) 부분을 완전히 덮어씌우세요!
app.get('/api/lyrics', async (req, res) => {
    const { artist, song } = req.query;

    try {
        // 1. 한국어 가사 원본을 가져오기 위한 다국어 지원 API 호출 (lrclib)
        const lyricsResponse = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(song)}&artist_name=${encodeURIComponent(artist)}`);
        const lyricsData = await lyricsResponse.json();

        if (!lyricsData || lyricsData.length === 0) {
            return res.status(404).json({ error: "가사를 찾을 수 없습니다 ㅠㅠ" });
        }

        // 가장 정확도가 높은 첫 번째 검색 결과 선택
        const track = lyricsData[0];
        const koreanLyrics = track.plainLyrics || "가사가 등록되지 않은 곡입니다.";

        // 2. 예쁜 배경을 위해 애플뮤직(iTunes) API에서 앨범 커버 훔쳐오기(?)
        const itunesResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + song)}&entity=song&limit=1`);
        const itunesData = await itunesResponse.json();
        
        let albumArt = "";
        if (itunesData.results && itunesData.results.length > 0) {
            // 작은 이미지를 고화질(600x600) 앨범 커버로 강제 변환!
            albumArt = itunesData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
        }

        // 3. 찾은 가사와 앨범 커버를 아이팟(프론트엔드)으로 쏴주기!
        res.json({
            title: track.trackName,
            artist: track.artistName,
            lyricsText: koreanLyrics,
            albumArt: albumArt
        });

    } catch (error) {
        console.error("서버 에러:", error);
        res.status(500).json({ error: "서버에서 가사를 가져오는 중 문제가 발생했어요." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});