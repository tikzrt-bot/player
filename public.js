// 公共播放器 - 无需登录，只读取数据库
class PublicPlayer {
    constructor() {
        this.audio = document.getElementById('audio');
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.playMode = 'sequence';
        this.playbackSpeed = 1.0;
        this.currentTextData = null;
        this.currentTextIndex = -1;

        console.log('初始化PublicPlayer');
        this.initElements();
        this.bindEvents();
        this.initDB();
        this.initScrollAnimations();
    }

    initElements() {
        console.log('开始初始化元素');
        this.playBtn = document.getElementById('play-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.rewindBtn = document.getElementById('rewind-btn');
        this.forwardBtn = document.getElementById('forward-btn');
        this.progressBar = document.getElementById('progress-bar');
        this.currentTimeEl = document.getElementById('current-time');
        this.durationEl = document.getElementById('duration');
        this.speedSelect = document.getElementById('speed-select');
        this.modeBtn = document.getElementById('mode-btn');
        this.modeText = document.getElementById('mode-text');
        this.trackName = document.getElementById('track-name');
        this.trackStatus = document.getElementById('track-status');
        this.playlistEl = document.getElementById('playlist');
        this.lyricsContainer = document.getElementById('lyrics-container');
        this.lyricsSection = document.getElementById('lyrics-section');
        this.textToggleBtn = document.getElementById('text-toggle-btn');
        this.isTextVisible = false;

        // 验证所有元素都存在
        const elementsToCheck = [
            { name: 'play-btn', el: this.playBtn },
            { name: 'prev-btn', el: this.prevBtn },
            { name: 'next-btn', el: this.nextBtn },
            { name: 'rewind-btn', el: this.rewindBtn },
            { name: 'forward-btn', el: this.forwardBtn },
            { name: 'progress-bar', el: this.progressBar },
            { name: 'speed-select', el: this.speedSelect },
            { name: 'mode-btn', el: this.modeBtn },
            { name: 'text-toggle-btn', el: this.textToggleBtn }
        ];

        elementsToCheck.forEach(({ name, el }) => {
            if (!el) {
                console.error(`${name} 元素未找到`);
            }
        });
    }

    bindEvents() {
        console.log('绑定事件监听器');

        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());
        this.rewindBtn.addEventListener('click', () => this.rewind());
        this.forwardBtn.addEventListener('click', () => this.forward());
        this.progressBar.addEventListener('input', (e) => this.seekTo(e.target.value));
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.onTrackEnd());
        this.speedSelect.addEventListener('change', (e) => this.setSpeed(parseFloat(e.target.value)));
        this.modeBtn.addEventListener('click', () => this.togglePlayMode());
        this.textToggleBtn.addEventListener('click', () => this.toggleText());
    }

    initDB() {
        console.log('初始化数据库');
        const request = indexedDB.open('AudioPlayerDB', 2);

        request.onerror = () => {
            console.error('数据库打开失败');
            this.playlistEl.innerHTML = '<li class="empty-message">无法加载播放列表</li>';
        };

        request.onupgradeneeded = (event) => {
            console.log('数据库升级，当前版本:', event.oldVersion);
            const db = request.result;
            // 如果没有 tracks 存储，创建它
            if (!db.objectStoreNames.contains('tracks')) {
                db.createObjectStore('tracks', { keyPath: 'name' });
                console.log('创建tracks存储');
            }
        };

        request.onsuccess = () => {
            console.log('数据库打开成功');
            this.db = request.result;
            this.loadPlaylistFromDB();
        };
    }

    loadPlaylistFromDB() {
        const transaction = this.db.transaction(['tracks'], 'readonly');
        const objectStore = transaction.objectStore('tracks');
        const request = objectStore.getAll();

        request.onsuccess = () => {
            const savedTracks = request.result;
            console.log('从数据库加载到', savedTracks.length, '个曲目');

            if (savedTracks.length === 0) {
                this.playlistEl.innerHTML = '<li class="empty-message">暂无音频，请等待管理员上传</li>';
                this.trackName.textContent = '暂无音频';
                this.trackStatus.textContent = '请等待管理员上传';
                return;
            }

            // 从 Base64 创建播放列表
            this.playlist = savedTracks.map(track => {
                let file;
                if (track.base64) {
                    const base64Data = track.base64.split(',')[1];
                    const byteCharacters = atob(base64Data);
                    const byteArrays = [];

                    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                        const slice = byteCharacters.slice(offset, offset + 512);
                        const byteNumbers = new Array(slice.length);
                        for (let i = 0; i < slice.length; i++) {
                            byteNumbers[i] = slice.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        byteArrays.push(byteArray);
                    }

                    const blob = new Blob(byteArrays, { type: track.mimeType || 'audio/mpeg' });
                    file = new File([blob], track.name, { type: track.mimeType || 'audio/mpeg' });
                } else if (track.file) {
                    file = track.file;
                }

                return {
                    name: track.name,
                    file: file,
                    url: URL.createObjectURL(file),
                    duration: track.duration,
                    textData: track.textData
                };
            });

            this.updatePlaylistUI();
            this.loadTrack(0);
        };

        request.onerror = () => {
            this.playlistEl.innerHTML = '<li class="empty-message">加载失败</li>';
        };
    }

    loadTrack(index) {
        console.log('加载曲目，索引:', index);

        if (index < 0 || index >= this.playlist.length) return;

        this.currentIndex = index;
        const track = this.playlist[index];

        console.log('曲目名称:', track.name);
        console.log('时长:', track.duration);
        console.log('文本数据:', track.textData);

        this.audio.src = track.url;
        this.audio.load();

        this.trackName.textContent = track.name;
        this.trackStatus.textContent = this.playMode === 'loop' ? '单曲循环' : '顺序播放';

        // Load text data
        this.currentTextData = track.textData || null;
        this.currentTextIndex = -1;
        console.log('设置 currentTextData:', this.currentTextData);
        this.updateLyricsDisplay();

        // 根据当前显示状态设置文本区域
        this.lyricsSection.style.display = this.isTextVisible ? 'block' : 'none';

        this.updatePlaylistUI();

        if (this.isPlaying) {
            this.audio.play();
        }
    }

    togglePlay() {
        if (this.playlist.length === 0) return;

        console.log('togglePlay 被调用，当前播放状态:', this.isPlaying);
        console.log('audio.paused:', this.audio.paused);

        if (this.audio.paused) {
            console.log('音频已暂停，开始播放');
            this.audio.play();
            this.isPlaying = true;
        } else {
            console.log('音频正在播放，停止播放');
            this.audio.pause();
            this.isPlaying = false;
        }
        this.updatePlayButton();
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        const newIndex = this.currentIndex - 1;
        if (newIndex >= 0) {
            this.loadTrack(newIndex);
            if (this.isPlaying) {
                this.audio.play();
            }
        }
    }

    playNext() {
        if (this.playlist.length === 0) return;

        if (this.playMode === 'loop') {
            this.audio.currentTime = 0;
            if (this.isPlaying) {
                this.audio.play();
            }
        } else {
            const newIndex = this.currentIndex + 1;
            if (newIndex < this.playlist.length) {
                this.loadTrack(newIndex);
                if (this.isPlaying) {
                    this.audio.play();
                }
            } else {
                this.isPlaying = false;
                this.updatePlayButton();
            }
        }
    }

    onTrackEnd() {
        console.log('曲目播放结束，当前索引:', this.currentIndex);
        this.playNext();
    }

    rewind() {
        // 倒退10秒
        this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
    }

    forward() {
        // 前进10秒
        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
    }

    updatePlayButton() {
        const playIcon = this.playBtn.querySelector('.play-icon');
        const pauseIcon = this.playBtn.querySelector('.pause-icon');

        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    updateProgress() {
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.progressBar.value = progress || 0;
        this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    updateLyricsDisplay() {
        console.log('updateLyricsDisplay 被调用');
        console.log('currentTextData:', this.currentTextData);

        if (!this.currentTextData || this.currentTextData.length === 0) {
            console.log('没有文本数据，显示提示');
            this.lyricsContainer.innerHTML = '<p class="no-lyrics">暂无文本内容</p>';
            return;
        }

        console.log('文本行数:', this.currentTextData.length);

        // Display all lines as plain text
        const html = this.currentTextData.map(line => {
            return `<p class="lyric-line">${line.content}</p>`;
        }).join('');

        this.lyricsContainer.innerHTML = html;
    }

    updateDuration() {
        this.durationEl.textContent = this.formatTime(this.audio.duration);
    }

    seekTo(value) {
        const time = (value / 100) * this.audio.duration;
        this.audio.currentTime = time;
    }

    setSpeed(speed) {
        this.playbackSpeed = speed;
        this.audio.playbackRate = speed;
    }

    togglePlayMode() {
        if (this.playMode === 'sequence') {
            this.playMode = 'loop';
            this.modeText.textContent = '单曲循环';
            this.modeBtn.classList.add('loop-mode');
        } else {
            this.playMode = 'sequence';
            this.modeText.textContent = '顺序播放';
            this.modeBtn.classList.remove('loop-mode');
        }

        if (this.currentIndex >= 0) {
            this.trackStatus.textContent = this.playMode === 'loop' ? '单曲循环' : '顺序播放';
        }
    }

    toggleText() {
        this.isTextVisible = !this.isTextVisible;

        if (this.isTextVisible) {
            this.lyricsSection.style.display = 'block';
            this.textToggleBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8V8h8v2z"/>
                </svg>
                <span>隐藏文本</span>
            `;
        } else {
            this.lyricsSection.style.display = 'none';
            this.textToggleBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8V8h8v2z"/>
                </svg>
                <span>显示文本</span>
            `;
        }
    }

    updatePlaylistUI() {
        if (this.playlist.length === 0) {
            this.playlistEl.innerHTML = '<div class="empty-message scroll-animate">暂无音频</div>';
            return;
        }

        this.playlistEl.innerHTML = this.playlist.map((track, index) => {
            const isActive = index === this.currentIndex;
            const isPlaying = isActive && this.isPlaying;

            // 添加延迟类
            const delayClass = `delay-${Math.min(index, 5)}`;

            return `
                <div class="playlist-card scroll-animate ${delayClass} ${isActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}" data-index="${index}">
                    <div class="card-icon">
                        ${isPlaying ? '<div class="playing-animation"></div>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'}
                    </div>
                    <div class="card-content">
                        <div class="card-header">
                            <span class="card-title">${track.name}</span>
                            ${track.duration ? `<span class="card-duration">${this.formatTime(track.duration)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.playlistEl.querySelectorAll('.playlist-card').forEach(card => {
            const index = parseInt(card.dataset.index);

            card.addEventListener('click', () => {
                this.loadTrack(index);
                if (!this.isPlaying) {
                    this.togglePlay();
                }
            });
        });

        // 重新观察新添加的元素
        if (this.observeScrollElements) {
            this.observeScrollElements();
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    initScrollAnimations() {
        // 创建 Intersection Observer 用于滚动动画
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    // 添加延迟以实现交错效果
                    setTimeout(() => {
                        entry.target.classList.add('animate-visible');
                    }, index * 100);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // 观察所有带有 scroll-animate 类的元素
        this.observeScrollElements = () => {
            const scrollElements = document.querySelectorAll('.scroll-animate');
            scrollElements.forEach(el => observer.observe(el));
        };

        // 初始观察
        setTimeout(() => this.observeScrollElements(), 100);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 加载完成');
    new PublicPlayer();
});
