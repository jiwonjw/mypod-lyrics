const express = require('express');
const cors = require('cors');
const Genius = require('genius-lyrics');

const app = express();
app.use(express.static(__dirname));
app.use(cors()); 

const Client = new Genius.Client();

app.get('/api/lyrics', async (req, res) => {
    try {
        const { artist, song } = req.query;
        console.log(`🔍 검색 요청: ${artist} - ${song}`);

        // 1. Genius에서 가사 검색
        const searches = await Client.songs.search(`${artist} ${song}`);
        if (searches.length === 0) return res.status(404).json({ error: "곡을 찾을 수 없습니다." });
        
        const firstSong = searches[0];
        let rawLyrics = await firstSong.lyrics();
        
        // 가사 불순물 제거 필터
        let cleanLyrics = rawLyrics.replace(/<[^>]*>?/gm, '');
        cleanLyrics = cleanLyrics.replace(/^\d+\s*Contributors.*?Lyrics\s*/i, '');
        cleanLyrics = cleanLyrics.trim();

        // 2. 기본 데이터 세팅 (Genius 기반)
        let finalData = {
            title: firstSong.title,
            artist: firstSong.artist.name,
            albumArt: firstSong.thumbnail, // 기본 썸네일
            album: firstSong.album ? firstSong.album.name : "싱글 / 정보 없음",
            releaseDate: firstSong.releaseDate || "발매일 정보 없음",
            genre: "팝 / 장르 미상",
            lyricsText: cleanLyrics
        };

        // 3. Apple Music API에서 고해상도 이미지 및 추가 메타데이터(장르, 앨범) 가져오기
        try {
            const appleUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + song)}&media=music&limit=1`;
            const appleRes = await fetch(appleUrl);
            const appleData = await appleRes.json();

            if (appleData.results.length > 0) {
                const track = appleData.results[0];
                // 사진 크기가 작게 나오는 것을 방지하기 위해 600x600 고해상도 이미지로 변환
                finalData.albumArt = track.artworkUrl100.replace('100x100bb', '600x600bb');
                finalData.album = track.collectionName || finalData.album;
                finalData.genre = track.primaryGenreName || finalData.genre;
                
                // 날짜 포맷 깔끔하게 다듬기 (YYYY-MM-DD)
                if (track.releaseDate) {
                    finalData.releaseDate = track.releaseDate.substring(0, 10);
                }
            }
        } catch (appleError) {
            console.log("애플 뮤직 데이터 연동 실패, Genius 기본 데이터를 사용합니다.");
        }

        // 완성된 데이터를 프론트엔드로 전송
        res.json(finalData);

    } catch (error) {
        console.error("서버 에러:", error);
        res.status(500).json({ error: "서버 오류 발생" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});