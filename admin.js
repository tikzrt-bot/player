// 后台管理 - 需要密码登录
class AdminPanel {
    constructor() {
        this.db = null;
        this.playlist = [];
        this.password = '123456'; // 默认密码，可修改
        this.isAuthenticated = false;
        this.currentIndex = -1;
        this.isPlaying = false;
        this.editingTrackIndex = -1;

        this.initElements();
        this.bindEvents();
        this.initDB();
        this.checkAuth();
    }

    initElements() {
        console.log('开始初始化元素');
        this.passwordInput = document.getElementById('password-input');
        this.loginBtn = document.getElementById('login-btn');
        this.errorMessage = document.getElementById('error-message');
        this.permissionSection = document.getElementById('permission-section');
        this.adminContent = document.getElementById('admin-content');
        this.audioInput = document.getElementById('audio-input');
        this.playlistEl = document.getElementById('playlist');
        this.trackCount = document.getElementById('track-count');
        this.audio = document.getElementById('audio');
        this.currentTextData = null;
        this.saveFeedback = document.getElementById('save-feedback');

        // 编辑弹窗元素
        this.editModal = document.getElementById('edit-modal');
        this.modalOverlay = document.getElementById('modal-overlay');
        this.modalCloseBtn = document.getElementById('modal-close-btn');
        this.modalCancelBtn = document.getElementById('modal-cancel-btn');
        this.modalSaveBtn = document.getElementById('modal-save-btn');
        this.editTrackName = document.getElementById('edit-track-name');
        this.editTrackDuration = document.getElementById('edit-track-duration');
        this.editTextInput = document.getElementById('edit-text-input');

        // 验证元素是否存在
        if (!this.passwordInput) {
            console.error('password-input 元素未找到');
        }
        if (!this.loginBtn) {
            console.error('login-btn 元素未找到');
        }
        if (!this.errorMessage) {
            console.error('error-message 元素未找到');
        }
        if (!this.audioInput) {
            console.error('audio-input 元素未找到');
        }

        console.log('所有元素初始化完成');
    }

    bindEvents() {
        this.loginBtn.addEventListener('click', () => this.login());
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });

        this.audioInput.addEventListener('change', (e) => this.handleAudioUpload(e));

        // 编辑弹窗事件
        this.modalCloseBtn.addEventListener('click', () => this.closeEditModal());
        this.modalCancelBtn.addEventListener('click', () => this.closeEditModal());
        this.modalOverlay.addEventListener('click', () => this.closeEditModal());
        this.modalSaveBtn.addEventListener('click', () => this.saveTrackEdit());
    }

    initDB() {
        console.log('初始化数据库');
        const request = indexedDB.open('AudioPlayerDB', 2);

        request.onerror = () => {
            console.error('数据库打开失败');
            this.playlistEl.innerHTML = '<li class="empty-message">数据库错误</li>';
        };

        request.onupgradeneeded = (event) => {
            const db = request.result;
            console.log('数据库需要升级，当前版本:', event.oldVersion);

            // 如果没有 tracks 存储，创建它
            if (!db.objectStoreNames.contains('tracks')) {
                const objectStore = db.createObjectStore('tracks', { keyPath: 'name' });
                console.log('创建tracks存储，使用name作为主键');
            } else {
                console.log('tracks存储已存在，保留数据');
            }
        };

        request.onsuccess = () => {
            this.db = request.result;
            console.log('数据库打开成功');
            if (this.isAuthenticated) {
                this.loadPlaylist();
            }
        };
    }

    checkAuth() {
        const authTime = localStorage.getItem('adminAuthTime');
        if (authTime) {
            console.log('找到认证时间:', authTime);
            const elapsed = Date.now() - parseInt(authTime);
            console.log('已过去时间(毫秒):', elapsed);
            if (elapsed < 604800000) { // 7天内免登录
                console.log('在有效期内，直接显示管理界面');
                this.isAuthenticated = true;
                this.showAdminPanel();
            }
        }
    }

    login() {
        console.log('开始登录验证');
        const inputPassword = this.passwordInput.value.trim();
        console.log('输入的密码:', inputPassword);
        console.log('正确的密码:', this.password);

        if (!inputPassword) {
            console.log('密码为空');
            this.errorMessage.textContent = '请输入密码';
            this.errorMessage.style.display = 'block';
            return;
        }

        if (inputPassword === this.password) {
            console.log('密码验证通过');
            this.isAuthenticated = true;
            localStorage.setItem('adminAuthTime', Date.now().toString());
            this.errorMessage.style.display = 'none';
            this.showAdminPanel();
        } else {
            console.log('密码验证失败');
            this.errorMessage.textContent = '密码错误，请重试';
            this.errorMessage.style.display = 'block';
            this.passwordInput.value = '';
            this.passwordInput.focus();
        }
    }

    showAdminPanel() {
        console.log('显示管理界面');
        this.permissionSection.style.display = 'none';
        this.adminContent.style.display = 'block';

        // 如果数据库已经准备好，加载播放列表
        if (this.db) {
            console.log('数据库已准备好，加载播放列表');
            this.loadPlaylist();
        } else {
            console.log('数据库尚未准备好，等待初始化完成');
        }
    }

    handleAudioUpload(e) {
        console.log('处理音频上传');
        const files = Array.from(e.target.files);
        console.log('上传的文件数量:', files.length);

        // 存储新上传的文件
        const newTracks = [];

        files.forEach((file) => {
            const trackName = file.name.replace(/\.[^/.]+$/, "");
            const track = {
                name: trackName,
                file: file,
                url: URL.createObjectURL(file),
                duration: null,
                textData: null  // 初始没有文本内容
            };

            this.playlist.push(track);
            newTracks.push(track);

            // 获取时长
            const tempAudio = new Audio(track.url);
            tempAudio.addEventListener('loadedmetadata', () => {
                track.duration = tempAudio.duration;
                console.log('音频时长:', track.duration, '秒');
                this.updatePlaylistUI();
            });
        });

        this.updatePlaylistUI();
        this.audioInput.value = '';

        // 只保存新上传的文件到数据库
        this.saveTracksToDB(newTracks);
    }

    // 保存指定的曲目到数据库
    saveTracksToDB(tracks) {
        if (!tracks || tracks.length === 0) return;

        console.log('保存', tracks.length, '个新文件到数据库');

        const saveNext = (index) => {
            if (index >= tracks.length) {
                console.log('所有新文件已保存');
                this.showSaveSuccess();
                return;
            }

            const track = tracks[index];
            const reader = new FileReader();

            reader.onload = (e) => {
                const trackData = {
                    name: track.name,
                    base64: e.target.result,
                    mimeType: track.file.type,
                    duration: track.duration,
                    textData: track.textData
                };

                console.log(`保存文件 ${track.name}，文本数据行数:`, track.textData ? track.textData.length : 0);

                const transaction = this.db.transaction(['tracks'], 'readwrite');
                const objectStore = transaction.objectStore('tracks');

                // 使用 put 操作，会自动处理新增和更新
                const request = objectStore.put(trackData);

                request.onsuccess = () => {
                    console.log(`文件 ${track.name} 已保存到数据库`);
                    saveNext(index + 1);
                };

                request.onerror = (event) => {
                    console.error(`保存 ${track.name} 失败:`, event.target.error);
                    saveNext(index + 1);
                };
            };

            reader.onerror = () => {
                console.error('读取文件失败:', track.name);
                saveNext(index + 1);
            };

            reader.readAsDataURL(track.file);
        };

        saveNext(0);
    }

    showSaveSuccess() {
        this.saveFeedback.style.display = 'block';
        setTimeout(() => {
            this.saveFeedback.style.display = 'none';
        }, 3000);
    }

    loadPlaylist() {
        console.log('加载播放列表');
        const transaction = this.db.transaction(['tracks'], 'readonly');
        const objectStore = transaction.objectStore('tracks');
        const request = objectStore.getAll();

        request.onsuccess = () => {
            console.log('加载成功，获取到', request.result.length, '个曲目');
            const savedTracks = request.result;

            if (savedTracks.length === 0) {
                console.log('没有保存的曲目');
                this.playlistEl.innerHTML = '<li class="empty-message">暂无音频，请上传</li>';
                this.playlist = [];
                this.updateTrackCount();
                return;
            }

            // 释放旧的URL
            this.playlist.forEach(track => URL.revokeObjectURL(track.url));

            // 从 Base64 创建播放列表
            this.playlist = savedTracks.map(track => {
                // 从 base64 创建 Blob 和 File
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
                    // 兼容旧的 File 对象格式
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

            console.log('播放列表已更新');
            this.updatePlaylistUI();
            this.updateTrackCount();
        };

        request.onerror = () => {
            console.error('加载失败');
            this.playlistEl.innerHTML = '<li class="empty-message">加载失败</li>';
        };
    }

    clearPlaylist() {
        if (!confirm('确定要清空所有音频吗？此操作不可恢复。')) {
            return;
        }

        console.log('清空播放列表和数据库');

        // 释放所有 URL
        this.playlist.forEach(track => URL.revokeObjectURL(track.url));

        // 清空数据库
        const transaction = this.db.transaction(['tracks'], 'readwrite');
        const objectStore = transaction.objectStore('tracks');
        objectStore.clear();

        this.playlist = [];
        this.updatePlaylistUI();
        this.updateTrackCount();
    }

    updateTrackCount() {
        this.trackCount.textContent = `(${this.playlist.length} 首)`;
    }

    updatePlaylistUI() {
        if (this.playlist.length === 0) {
            this.playlistEl.innerHTML = '<li class="empty-message">暂无音频，请上传</li>';
            return;
        }

        this.playlistEl.innerHTML = this.playlist.map((track, index) => {
            // 准备文本内容显示
            let textDisplay = '';
            if (track.textData && track.textData.length > 0) {
                const previewText = track.textData.map(line => line.content).join(' ');
                // 显示前50个字符作为预览
                textDisplay = previewText.length > 50
                    ? previewText.substring(0, 50) + '...'
                    : previewText;
            }

            return `
                <li class="playlist-item" data-index="${index}" draggable="true">
                    <div class="drag-handle" title="拖拽排序">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11 18c0 1.1-.9 2-2s-.9-2-2-.9-2 2.9 2 2-.9-2-2-.9-2 2z"/>
                        </svg>
                    </div>
                    <div style="width:8px;"></div>
                    <div class="track-details">
                        <div class="track-header">
                            <span class="track-name">${track.name}</span>
                            ${track.duration ? `<span class="track-duration">${this.formatTime(track.duration)}</span>` : ''}
                        </div>
                        ${textDisplay ? `<div class="track-text-preview">${textDisplay}</div>` : '<div class="track-text-preview" style="color: #999;">无文本内容</div>'}
                    </div>
                    <button class="remove-btn" data-index="${index}" title="移除">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 10.59 12 5 17.59 6.41 19 21 7l-1.41 1.41-1z"/>
                        </svg>
                    </button>
                </li>
            `;
        }).join('');

        // 绑定事件
        this.playlistEl.querySelectorAll('.playlist-item').forEach(item => {
            const index = parseInt(item.dataset.index);

            // 点击打开编辑弹窗
            item.addEventListener('click', (e) => {
                if (e.target.closest('.remove-btn')) return;
                this.openEditModal(index);
            });

            // 拖拽事件
            item.addEventListener('dragstart', (e) => {
                console.log('开始拖拽，索引:', index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.playlistEl.querySelectorAll('.playlist-item').forEach(i => {
                    i.classList.remove('drag-over');
                });
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const targetIndex = parseInt(item.dataset.index);
                const draggingIndex = parseInt(e.dataTransfer.getData('text/plain'));
                console.log('拖拽到索引:', targetIndex, '从索引:', draggingIndex);

                if (targetIndex !== draggingIndex) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(item.dataset.index);

                if (fromIndex !== toIndex) {
                    this.moveTrack(fromIndex, toIndex);
                }
            });
        });

        // 移除按钮事件
        this.playlistEl.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                console.log('移除曲目，索引:', index);
                this.removeTrack(index);
            });
        });
    }

    previewTrack(index) {
        console.log('预览曲目，索引:', index);
        if (index < 0 || index >= this.playlist.length) return;
        const track = this.playlist[index];
        this.audio.src = track.url;
        this.audio.play();
    }

    moveTrack(fromIndex, toIndex) {
        console.log('移动曲目:', fromIndex, '->', toIndex);
        const track = this.playlist.splice(fromIndex, 1)[0];
        this.playlist.splice(toIndex, 0, track);
        this.updatePlaylistUI();
    }

    removeTrack(index) {
        console.log('移除曲目，索引:', index);
        const track = this.playlist[index];
        URL.revokeObjectURL(track.url);

        // 从数据库删除
        const transaction = this.db.transaction(['tracks'], 'readwrite');
        const objectStore = transaction.objectStore('tracks');
        objectStore.delete(track.name);

        this.playlist.splice(index, 1);
        this.updatePlaylistUI();
        this.updateTrackCount();
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // 打开编辑弹窗
    openEditModal(index) {
        console.log('打开编辑弹窗，索引:', index);
        this.editingTrackIndex = index;
        const track = this.playlist[index];

        // 填充弹窗内容
        this.editTrackName.textContent = track.name;
        this.editTrackDuration.textContent = track.duration ? this.formatTime(track.duration) : '未知';

        // 填充文本内容
        if (track.textData && track.textData.length > 0) {
            this.editTextInput.value = track.textData.map(line => line.content).join('\n');
        } else {
            this.editTextInput.value = '';
        }

        // 显示弹窗
        this.editModal.style.display = 'block';
        setTimeout(() => {
            this.editModal.classList.add('show');
        }, 10);
    }

    // 关闭编辑弹窗
    closeEditModal() {
        console.log('关闭编辑弹窗');
        this.editModal.classList.remove('show');
        setTimeout(() => {
            this.editModal.style.display = 'none';
            this.editingTrackIndex = -1;
        }, 300);
    }

    // 保存音频编辑
    saveTrackEdit() {
        if (this.editingTrackIndex < 0 || this.editingTrackIndex >= this.playlist.length) {
            console.error('无效的索引:', this.editingTrackIndex);
            return;
        }

        const track = this.playlist[this.editingTrackIndex];
        const textContent = this.editTextInput.value.trim();

        // 解析文本内容
        let textData = null;
        if (textContent) {
            textData = textContent.split('\n').filter(line => line.trim()).map(line => ({
                content: line.trim()
            }));
            console.log('更新文本数据，行数:', textData.length);
        } else {
            console.log('清除文本数据');
        }

        // 更新内存中的数据
        track.textData = textData;

        // 保存到数据库
        this.saveSingleTrackToDB(track);

        // 更新播放列表UI
        this.updatePlaylistUI();

        // 关闭弹窗
        this.closeEditModal();

        // 显示成功提示
        this.showSaveSuccess();
    }

    // 保存单个音频到数据库
    saveSingleTrackToDB(track) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const trackData = {
                name: track.name,
                base64: e.target.result,
                mimeType: track.file.type,
                duration: track.duration,
                textData: track.textData
            };

            console.log(`保存文件 ${track.name}，文本数据行数:`, track.textData ? track.textData.length : 0);

            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const objectStore = transaction.objectStore('tracks');

            const request = objectStore.put(trackData);

            request.onsuccess = () => {
                console.log(`文件 ${track.name} 已更新到数据库`);
            };

            request.onerror = (event) => {
                console.error(`保存 ${track.name} 失败:`, event.target.error);
            };
        };

        reader.onerror = () => {
            console.error('读取文件失败:', track.name);
        };

        reader.readAsDataURL(track.file);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 加载完成，开始初始化后台管理');
    new AdminPanel();
});
