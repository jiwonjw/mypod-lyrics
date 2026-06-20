const express = require('express');
const path = require('path');
const { Client } = require("genius-lyrics");
const genius = new Client(); // Genius 우회 라이브러리

const app = express();

// 인터넷에서 화면과 이미지를 볼 수 있도록 폴더 개방
app.use(express.static(__dirname));

// 누군가 메인 주소('/')로 오면 무조건 index.html을 보여주기
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🌟 핵심: 한국어 API -> Genius 자동 전환 가사 라우터
app.get('/api/lyrics', async (req, res) => {
    const { artist, song } = req.query;

    // ── [1순위 시도] lrclib (한국어 원본 가사 특화) ──
    try {
        console.log(`[1순위 시도] lrclib에서 검색: ${artist} - ${song}`);
        const lyricsResponse = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(song)}&artist_name=${encodeURIComponent(artist)}`);
        
        if (lyricsResponse.ok) {
            const lyricsData = await lyricsResponse.json();
            
            if (lyricsData && lyricsData.length > 0 && lyricsData[0].plainLyrics) {
                const track = lyricsData[0];
                console.log(`🟢 1순위 lrclib에서 깨끗한 원본 가사를 찾았습니다!`);
                
                let albumArt = "";
                try {
                    const itunesResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + song)}&entity=song&limit=1`);
                    const itunesData = await itunesResponse.json();
                    if (itunesData.results && itunesData.results.length > 0) {
                        albumArt = itunesData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                    }
                } catch (e) {
                    console.log("애플뮤직 커버 가져오기 실패");
                }

                return res.json({
                    title: track.trackName,
                    artist: track.artistName,
                    lyricsText: track.plainLyrics,
                    albumArt: albumArt
                });
            }
        }
        console.log(`🟡 lrclib에 가사가 없네요. 2순위 Genius로 자동 전환합니다.`);
    } catch (lrclibError) {
        console.error("lrclib 서버 에러 발생 -> Genius 폴백 가동");
    }

    // ── [2순위 시도] Genius (전 세계 최대 가사 데이터베이스) ──
    try {
        console.log(`[2순위 폴백] Genius에서 검색: ${artist} - ${song}`);
        const searches = await genius.songs.search(`${artist} ${song}`);
        
        if (!searches || searches.length === 0) {
            return res.status(404).json({ error: "모든 데이터베이스에 가사가 등록되지 않은 곡입니다 ㅠㅠ" });
        }
        
        const firstSong = searches[0];
        let lyricsText = await firstSong.lyrics(); // 내용을 고칠 수 있게 let으로 선언!

        // 🧹 [마법의 청소기] 지저분한 태그와 쓰레기 텍스트 싹 밀어버리기!
        lyricsText = lyricsText.replace(/<[^>]*>/g, ''); // 1. HTML 이미지 태그(<img...>) 완전 삭제
        lyricsText = lyricsText.replace(/^\d*\s*Contributors?[^\n]*Lyrics/i, ''); // 2. "3 Contributors ROUND TWO Lyrics" 같은 머리말 삭제
        lyricsText = lyricsText.replace(/\d*\s*Embed$/i, ''); // 3. 간혹 맨 끝에 붙는 Embed 꼬리표 삭제
        lyricsText = lyricsText.trim(); // 4. 깔끔하게 양끝 여백 정리

        let albumArt = firstSong.thumbnail; 
        try {
            const itunesResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + song)}&entity=song&limit=1`);
            const itunesData = await itunesResponse.json();
            if (itunesData.results && itunesData.results.length > 0) {
                albumArt = itunesData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
            }
        } catch (e) {
            console.log("애플뮤직 커버 가져오기 실패");
        }

        console.log(`🟢 2순위 Genius에서 가사를 최종 확보했습니다!`);
        return res.json({
            title: firstSong.title,
            artist: firstSong.artist.name,
            lyricsText: lyricsText,
            albumArt: albumArt
        });

    } catch (geniusError) {
        console.error("Genius 최종 에러:", geniusError);
        res.status(500).json({ error: "가사를 가져오는 중 서버 오류가 발생했습니다." });
    }
});

// Render 환경에 맞는 포트 설정
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});