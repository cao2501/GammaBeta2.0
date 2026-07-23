document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = null;
  let activeGuildId = null;
  let activeModuleName = null;
  let socket = null;
  let rawModulesData = [];
  let currentCategory = 'all';
  let searchQuery = '';

  // Toast Notification Helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // 1. Check Auth & Load User Profile
  try {
    const userRes = await fetch('/auth/user');
    currentUser = await userRes.json();
    if (!currentUser) {
      window.location.href = '/';
      return;
    }
    
    document.getElementById('user-name').innerText = currentUser.username;
    if (currentUser.avatar) {
      document.getElementById('user-avatar').src = currentUser.avatar;
    }
  } catch (err) {
    window.location.href = '/';
    return;
  }

  // 2. Fetch System Stats
  async function loadStats() {
    try {
      const statsRes = await fetch('/api/stats');
      const stats = await statsRes.json();
      
      document.getElementById('ping-val').innerText = stats.ping;
      document.getElementById('modules-val').innerText = stats.modulesCount;
      document.getElementById('commands-val').innerText = stats.commandsCount;
      document.getElementById('ram-val').innerText = stats.ram?.heapUsed || '--';

      // Top metrics bar
      document.getElementById('top-ping-val').innerText = `${stats.ping} ms`;
      document.getElementById('top-modules-val').innerText = `${stats.modulesCount} Active`;
      document.getElementById('top-commands-val').innerText = `${stats.commandsCount} Total`;

      const maintenanceBtn = document.getElementById('btn-maintenance');
      if (stats.maintenanceMode) {
        maintenanceBtn.innerText = '🔧 Bảo Trì: ĐANG BẬT';
        maintenanceBtn.classList.add('active-warn');
      } else {
        maintenanceBtn.innerText = '🔧 Chế Độ Bảo Trì';
        maintenanceBtn.classList.remove('active-warn');
      }
    } catch {}
  }
  loadStats();
  setInterval(loadStats, 10000);

  // 3. Populate Guild Selector
  try {
    const guildsRes = await fetch('/api/guilds');
    const guilds = await guildsRes.json();
    const select = document.getElementById('server-select');
    select.innerHTML = '<option value="" disabled selected>-- Chọn máy chủ quản lý --</option>';
    
    guilds.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.innerText = g.inGuild ? `🎮 ${g.name}` : `➕ ${g.name} (Chưa mời bot)`;
      opt.dataset.inGuild = g.inGuild;
      opt.dataset.inviteUrl = g.inviteUrl;
      select.appendChild(opt);
    });
  } catch {}

  function getActiveTab() {
    const activeItem = document.querySelector('.nav-item.active');
    return activeItem ? activeItem.dataset.tab : 'config';
  }

  function loadActiveTabData(guildId) {
    const activeTab = getActiveTab();
    if (activeTab === 'config') {
      loadModules(guildId);
    } else if (activeTab === 'prefix') {
      loadPrefixSettings(guildId);
    } else if (activeTab === 'permissions') {
      loadPermissionsSettings(guildId);
    }
  }

  // 4. Tab Navigation
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      const tabId = item.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      const targetTab = document.getElementById(`tab-${tabId}`);
      if (targetTab) targetTab.classList.add('active');

      if (activeGuildId) {
        loadActiveTabData(activeGuildId);
      }
    });
  });

  // 5. Handle Guild Selection Change
  const select = document.getElementById('server-select');
  select.addEventListener('change', async (e) => {
    const selectedOpt = select.options[select.selectedIndex];
    const guildId = selectedOpt.value;
    const inGuild = selectedOpt.dataset.inGuild === 'true';

    if (!inGuild) {
      window.open(selectedOpt.dataset.inviteUrl, '_blank');
      select.value = activeGuildId || '';
      return;
    }

    activeGuildId = guildId;
    document.getElementById('current-server-title').innerText = `Cấu hình cho máy chủ: ${selectedOpt.innerText.replace('🎮 ', '')}`;
    loadActiveTabData(guildId);
  });

  // Category & Search Helpers for Modules
  function getModuleCategory(name) {
    const n = name.toLowerCase();
    if (n.includes('antinuke') || n.includes('scam') || n.includes('verification')) return 'security';
    if (n.includes('moderation') || n.includes('logging') || n.includes('starboard')) return 'moderation';
    if (n.includes('economy') || n.includes('shop') || n.includes('premium')) return 'economy';
    if (n.includes('ai') || n.includes('music')) return 'ai';
    return 'utility';
  }

  function filterAndRenderModules() {
    const container = document.getElementById('modules-list');
    if (!rawModulesData.length) return;

    const filtered = rawModulesData.filter(m => {
      const cat = getModuleCategory(m.name);
      const matchCat = currentCategory === 'all' || cat === currentCategory;
      const matchSearch = !searchQuery || m.displayName.toLowerCase().includes(searchQuery) || m.name.toLowerCase().includes(searchQuery) || m.description.toLowerCase().includes(searchQuery);
      return matchCat && matchSearch;
    });

    container.innerHTML = '';
    if (!filtered.length) {
      container.innerHTML = '<p class="placeholder-text" style="color:var(--text-muted); padding:16px;">Không tìm thấy module phù hợp.</p>';
      return;
    }

    filtered.forEach(m => {
      const item = document.createElement('div');
      item.className = `module-item glass-item ${m.name === activeModuleName ? 'active' : ''}`;
      
      item.innerHTML = `
        <div class="module-info-row">
          <div class="module-title-desc">
            <span class="m-title">${m.displayName} ${m.premium ? '💎' : ''}</span>
            <span class="m-desc">${m.description}</span>
          </div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-${m.name}" ${m.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      `;

      const cb = item.querySelector(`input[type="checkbox"]`);
      cb.addEventListener('change', async (evt) => {
        try {
          const toggleRes = await fetch(`/api/guilds/${activeGuildId}/modules/${m.name}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: evt.target.checked })
          });
          const data = await toggleRes.json();
          if (data.success) {
            m.enabled = evt.target.checked;
            showToast(`Module ${m.displayName} đã ${m.enabled ? 'BẬT' : 'TẮT'}.`, 'success');
          } else {
            evt.target.checked = !evt.target.checked;
            showToast('Không thể lưu trạng thái module.', 'error');
          }
        } catch {
          evt.target.checked = !evt.target.checked;
          showToast('Lỗi kết nối mạng.', 'error');
        }
      });

      item.addEventListener('click', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.className === 'slider' || event.target.className === 'switch') return;
        document.querySelectorAll('.module-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        selectModuleForEditing(m);
      });

      container.appendChild(item);
    });
  }

  // 6. Load Modules List for Guild
  async function loadModules(guildId) {
    const container = document.getElementById('modules-list');
    container.innerHTML = '<div class="loader">Đang tải danh sách modules...</div>';

    activeModuleName = null;
    document.getElementById('editing-module-name').innerText = 'Chưa chọn';
    document.getElementById('config-textarea').value = '';
    document.getElementById('config-textarea').disabled = true;
    document.getElementById('btn-save-config').disabled = true;
    document.getElementById('btn-format-json').disabled = true;

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules`);
      rawModulesData = await res.json();
      filterAndRenderModules();
    } catch {
      container.innerHTML = '<div class="error-text">❌ Không thể tải danh sách modules.</div>';
    }
  }

  // Category Filter Button Clicks
  document.querySelectorAll('.cat-pill[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      filterAndRenderModules();
    });
  });

  // Search Input Handler
  const searchInput = document.getElementById('module-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterAndRenderModules();
    });
  }

  // 7. Select a Module to Edit JSON Config
  function selectModuleForEditing(mod) {
    activeModuleName = mod.name;
    document.getElementById('editing-module-name').innerText = mod.displayName;

    const textarea = document.getElementById('config-textarea');
    textarea.value = JSON.stringify(mod.config, null, 2);
    textarea.disabled = false;

    document.getElementById('btn-save-config').disabled = false;
    document.getElementById('btn-format-json').disabled = false;
    document.getElementById('config-status-msg').innerText = '';
  }

  // Format JSON Button
  const formatBtn = document.getElementById('btn-format-json');
  if (formatBtn) {
    formatBtn.addEventListener('click', () => {
      const textarea = document.getElementById('config-textarea');
      try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(parsed, null, 2);
        showToast('Đã định dạng JSON đẹp mắt!', 'success');
      } catch {
        showToast('Lỗi cú pháp JSON, không thể định dạng.', 'error');
      }
    });
  }

  // 8. Save Module Config
  const saveBtn = document.getElementById('btn-save-config');
  saveBtn.addEventListener('click', async () => {
    const textarea = document.getElementById('config-textarea');
    const msgSpan = document.getElementById('config-status-msg');

    let parsedConfig;
    try {
      parsedConfig = JSON.parse(textarea.value);
    } catch (err) {
      msgSpan.innerText = '❌ JSON không đúng định dạng!';
      msgSpan.className = 'status-msg error';
      showToast('Cú pháp JSON không hợp lệ!', 'error');
      return;
    }

    msgSpan.innerText = '🔄 Đang lưu...';
    msgSpan.className = 'status-msg';

    try {
      const res = await fetch(`/api/guilds/${activeGuildId}/modules/${activeModuleName}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: parsedConfig })
      });
      const data = await res.json();
      if (data.success) {
        msgSpan.innerText = '✅ Đã lưu cấu hình!';
        msgSpan.className = 'status-msg success';
        showToast(`Đã lưu cấu hình module ${activeModuleName}!`, 'success');
        
        const target = rawModulesData.find(m => m.name === activeModuleName);
        if (target) target.config = parsedConfig;
      } else {
        msgSpan.innerText = `❌ Lỗi: ${data.error}`;
        msgSpan.className = 'status-msg error';
        showToast(`Lỗi: ${data.error}`, 'error');
      }
    } catch {
      msgSpan.innerText = '❌ Lỗi kết nối mạng.';
      msgSpan.className = 'status-msg error';
      showToast('Lỗi kết nối mạng.', 'error');
    }
  });

  // 9. Web Socket Live Log Terminal
  socket = io();
  const terminal = document.getElementById('terminal-output') || document.getElementById('log-terminal');
  let currentLogLevel = 'all';

  if (socket && terminal) {
    socket.on('log_message', (log) => {
      if (currentLogLevel !== 'all' && log.level.toLowerCase() !== currentLogLevel) return;

      const p = document.createElement('div');
      p.className = `log-line`;
      
      const timeStr = log.timestamp ? log.timestamp.slice(11, 19) : new Date().toLocaleTimeString();
      const levelClass = log.level === 'error' ? 'log-level-error' : log.level === 'warn' ? 'log-level-warn' : 'log-level-info';
      
      p.innerHTML = `
        <span class="log-time">[${timeStr}]</span>
        <span class="log-module">${log.module || 'system'}</span>
        <span class="log-level ${levelClass}">${(log.level || 'INFO').toUpperCase()}</span>
        <span class="log-msg">${log.message}</span>
      `;
      
      terminal.appendChild(p);

      const autoscroll = document.getElementById('chk-autoscroll');
      if (autoscroll && autoscroll.checked) {
        terminal.scrollTop = terminal.scrollHeight;
      }

      if (terminal.children.length > 300) {
        terminal.removeChild(terminal.firstChild);
      }
    });
  }

  document.querySelectorAll('.log-level-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.log-level-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentLogLevel = pill.dataset.level;
    });
  });

  const clearLogsBtn = document.getElementById('btn-clear-logs');
  if (clearLogsBtn && terminal) {
    clearLogsBtn.addEventListener('click', () => {
      terminal.innerHTML = '<div class="log-line"><span class="log-time">[System]</span><span class="log-module">dashboard</span><span class="log-level log-level-info">INFO</span><span class="log-msg">Terminal logs cleared.</span></div>';
      showToast('Đã xóa danh sách logs.', 'info');
    });
  }

  // 10. Toggle Maintenance Mode
  const maintenanceBtn = document.getElementById('btn-maintenance');
  if (maintenanceBtn) {
    maintenanceBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/owner/maintenance', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          loadStats();
          showToast(`Chế độ bảo trì đã ${data.maintenanceMode ? 'BẬT' : 'TẮT'}.`, 'success');
        } else {
          showToast(`Lỗi: ${data.error || 'Quyền hạn bị từ chối'}`, 'error');
        }
      } catch {
        showToast('Không thể kết nối đến server.', 'error');
      }
    });
  }

  // 11. PREFIX & ALIAS PANEL LOGIC
  let prefixData = null;

  async function loadPrefixSettings(guildId) {
    const aliasContainer = document.getElementById('alias-list');
    if (aliasContainer) aliasContainer.innerHTML = '<div class="loader">Đang tải data alias...</div>';

    try {
      const res = await fetch(`/api/guilds/${guildId}/prefix`);
      if (!res.ok) return;
      prefixData = await res.json();

      const globalInput = document.getElementById('global-prefix-input');
      const globalBadge = document.getElementById('global-prefix-badge');
      const aliasBadge  = document.getElementById('alias-prefix-preview');
      const currentGlobalPrefixText = document.getElementById('current-global-prefix');
      const saveGlobalBtn = document.getElementById('btn-save-global-prefix');

      if (globalInput) globalInput.value = prefixData.globalPrefix || 'kn';
      if (globalBadge) globalBadge.textContent = prefixData.globalPrefix || 'kn';
      if (aliasBadge) aliasBadge.textContent = prefixData.globalPrefix || 'kn';
      if (currentGlobalPrefixText) currentGlobalPrefixText.textContent = prefixData.globalPrefix || 'kn';
      if (saveGlobalBtn) saveGlobalBtn.disabled = false;

      updatePrefixPreview(prefixData.globalPrefix || 'kn');

      // Populate command select dropdown for new alias
      const cmdSelect = document.getElementById('new-alias-command');
      if (cmdSelect) {
        cmdSelect.innerHTML = '<option value="">-- Chọn lệnh --</option>';
        (prefixData.commands || []).forEach(cmd => {
          const opt = document.createElement('option');
          opt.value = cmd.name;
          opt.textContent = `/${cmd.name}`;
          opt.dataset.subcommands = JSON.stringify(cmd.subcommands || []);
          cmdSelect.appendChild(opt);
        });
      }

      const addAliasBtn = document.getElementById('btn-add-alias');
      if (addAliasBtn) addAliasBtn.disabled = false;

      renderAliasList();
    } catch {
      if (aliasContainer) aliasContainer.innerHTML = '<p class="placeholder-text" style="color:var(--text-muted);">❌ Lỗi tải dữ liệu Prefix.</p>';
    }
  }

  function renderAliasList() {
    const container = document.getElementById('alias-list');
    if (!container) return;

    const aliases = prefixData?.aliases ?? {};
    const keys = Object.keys(aliases);
    if (!keys.length) {
      container.innerHTML = '<p class="placeholder-text" style="color:var(--text-muted); padding:10px 0;">Chưa có alias nào. Thêm alias ở form trên.</p>';
      return;
    }

    container.innerHTML = '';
    keys.sort().forEach(key => {
      const { command, subcommand } = aliases[key];
      const globalPrefix = prefixData.globalPrefix || '!';
      const example = `${globalPrefix}${key}`;
      const slashEquiv = subcommand ? `/${command} ${subcommand}` : `/${command}`;

      const row = document.createElement('div');
      row.className = 'alias-row';
      row.innerHTML = `
        <span class="alias-key"><code>${globalPrefix}${key}</code></span>
        <span class="alias-sep">→</span>
        <span class="alias-cmd"><code>/${command}</code></span>
        <span class="alias-sub">${subcommand ? `<code>${subcommand}</code>` : '<span class="alias-none">—</span>'}</span>
        <span class="alias-example">
          <code>${example}</code>
          <span class="alias-equiv">≡ <code>${slashEquiv}</code></span>
        </span>
        <button class="alias-delete-btn" data-key="${key}" title="Xóa alias">🗑️</button>
      `;

      row.querySelector('.alias-delete-btn').addEventListener('click', async () => {
        if (!confirm(`Xóa alias "${key}"?`)) return;
        try {
          const res = await fetch(`/api/guilds/${activeGuildId}/prefix/alias/${encodeURIComponent(key)}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            delete prefixData.aliases[key];
            renderAliasList();
            showToast(`Đã xóa alias "${key}"`, 'success');
          } else {
            showToast(`❌ ${data.error || 'Lỗi xóa'}`, 'error');
          }
        } catch { showToast('Lỗi kết nối mạng.', 'error'); }
      });

      container.appendChild(row);
    });
  }

  function updatePrefixPreview(val) {
    const pTag = document.getElementById('preview-prefix-tag');
    const pEx = document.getElementById('preview-cmd-example');
    if (pTag) pTag.innerText = val || 'kn';
    if (pEx) pEx.innerText = val || 'kn';
  }

  const globalPrefixInput = document.getElementById('global-prefix-input');
  if (globalPrefixInput) {
    globalPrefixInput.addEventListener('input', (e) => {
      const val = e.target.value || '!';
      const globalBadge = document.getElementById('global-prefix-badge');
      const aliasBadge  = document.getElementById('alias-prefix-preview');
      if (globalBadge) globalBadge.textContent = val;
      if (aliasBadge) aliasBadge.textContent = val;
      updatePrefixPreview(val);
    });
  }

  const saveGlobalPrefixBtn = document.getElementById('btn-save-global-prefix');
  if (saveGlobalPrefixBtn) {
    saveGlobalPrefixBtn.addEventListener('click', async () => {
      const prefix = document.getElementById('global-prefix-input').value.trim();
      if (!prefix || !activeGuildId) return;
      try {
        const res = await fetch(`/api/guilds/${activeGuildId}/prefix/global`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix })
        });
        const data = await res.json();
        if (data.success) {
          if (prefixData) prefixData.globalPrefix = prefix;
          const currentGlobal = document.getElementById('current-global-prefix');
          if (currentGlobal) currentGlobal.textContent = prefix;
          showToast(`Đã lưu Prefix tổng: "${prefix}"`, 'success');
          renderAliasList();
        } else {
          showToast(`Lỗi: ${data.error}`, 'error');
        }
      } catch { showToast('Lỗi kết nối mạng.', 'error'); }
    });
  }

  const aliasCmdSelect = document.getElementById('new-alias-command');
  if (aliasCmdSelect) {
    aliasCmdSelect.addEventListener('change', (e) => {
      const selected = e.target.options[e.target.selectedIndex];
      const subcmdSelect = document.getElementById('new-alias-subcommand');
      if (!subcmdSelect) return;

      subcmdSelect.innerHTML = '<option value="">-- Không có --</option>';
      if (!selected.value) {
        subcmdSelect.disabled = true;
        return;
      }

      const subs = JSON.parse(selected.dataset.subcommands || '[]');
      if (subs.length > 0) {
        subs.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          subcmdSelect.appendChild(opt);
        });
        subcmdSelect.disabled = false;
      } else {
        subcmdSelect.disabled = true;
      }
    });
  }

  const addAliasBtn = document.getElementById('btn-add-alias');
  if (addAliasBtn) {
    addAliasBtn.addEventListener('click', async () => {
      const alias = document.getElementById('new-alias-text').value.trim().toLowerCase().replace(/\s+/g, '');
      const command = document.getElementById('new-alias-command').value;
      const subcommand = document.getElementById('new-alias-subcommand').value;

      if (!alias) { showToast('Vui lòng nhập tên alias.', 'error'); return; }
      if (!command) { showToast('Vui lòng chọn lệnh slash.', 'error'); return; }
      if (!activeGuildId) { showToast('Chưa chọn máy chủ.', 'error'); return; }

      try {
        const res = await fetch(`/api/guilds/${activeGuildId}/prefix/alias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alias, command, subcommand: subcommand || undefined })
        });
        const data = await res.json();
        if (data.success) {
          if (!prefixData.aliases) prefixData.aliases = {};
          prefixData.aliases[alias] = { command, ...(subcommand ? { subcommand } : {}) };
          renderAliasList();
          showToast(`Đã thêm alias: ${prefixData.globalPrefix || '!'}${alias} → /${command}`, 'success');
          
          document.getElementById('new-alias-text').value = '';
          document.getElementById('new-alias-command').value = '';
          const subSel = document.getElementById('new-alias-subcommand');
          if (subSel) {
            subSel.innerHTML = '<option value="">-- Không có --</option>';
            subSel.disabled = true;
          }
        } else {
          showToast(`Lỗi: ${data.error}`, 'error');
        }
      } catch { showToast('Lỗi kết nối mạng khi thêm Alias.', 'error'); }
    });
  }

  // 12. PERMISSIONS TAB LOGIC
  let guildRoles = [];
  let allCommandsMap = {};
  let commandPermissions = {};
  let activePermissionKey = null;

  async function loadPermissionsSettings(guildId) {
    const moduleSelect = document.getElementById('perm-module-select');
    const commandSelect = document.getElementById('perm-command-select');
    
    if (moduleSelect) moduleSelect.innerHTML = '<option value="">-- Đang tải... --</option>';
    if (commandSelect) {
      commandSelect.innerHTML = '<option value="">-- Tất cả lệnh trong Module --</option>';
      commandSelect.disabled = true;
    }
    
    const permArea = document.getElementById('permission-settings-area');
    if (permArea) permArea.style.display = 'none';

    try {
      const [rolesRes, cmdsRes, permsRes, modulesRes] = await Promise.all([
        fetch(`/api/guilds/${guildId}/roles`),
        fetch(`/api/guilds/${guildId}/commands`),
        fetch(`/api/guilds/${guildId}/permissions`),
        fetch(`/api/guilds/${guildId}/modules`)
      ]);

      guildRoles = await rolesRes.json();
      allCommandsMap = await cmdsRes.json();
      commandPermissions = await permsRes.json();
      const modules = await modulesRes.json();

      if (moduleSelect) {
        moduleSelect.innerHTML = '<option value="">-- Chọn Module --</option>';
        modules.forEach(mod => {
          const opt = document.createElement('option');
          opt.value = mod.name;
          opt.textContent = mod.displayName || mod.name;
          moduleSelect.appendChild(opt);
        });
      }
    } catch (err) {
      if (moduleSelect) moduleSelect.innerHTML = '<option value="">-- Lỗi tải dữ liệu --</option>';
    }
  }

  const permModSelect = document.getElementById('perm-module-select');
  const permCmdSelect = document.getElementById('perm-command-select');

  if (permModSelect) {
    permModSelect.addEventListener('change', () => {
      const moduleName = permModSelect.value;
      if (permCmdSelect) permCmdSelect.innerHTML = '<option value="">-- Tất cả lệnh trong Module --</option>';
      
      if (!moduleName) {
        if (permCmdSelect) permCmdSelect.disabled = true;
        const permArea = document.getElementById('permission-settings-area');
        if (permArea) permArea.style.display = 'none';
        activePermissionKey = null;
        return;
      }

      const cmds = allCommandsMap[moduleName] || [];
      if (permCmdSelect) {
        cmds.forEach(cmd => {
          const opt = document.createElement('option');
          opt.value = cmd;
          opt.textContent = `/${cmd}`;
          permCmdSelect.appendChild(opt);
        });
        permCmdSelect.disabled = false;
      }

      activePermissionKey = `module:${moduleName}`;
      const nameElem = document.getElementById('perm-editing-command-name');
      if (nameElem) nameElem.textContent = `Module: ${moduleName.toUpperCase()}`;
      
      renderPermissionsRolesPickers(activePermissionKey);
      const permArea = document.getElementById('permission-settings-area');
      if (permArea) permArea.style.display = 'block';
    });
  }

  if (permCmdSelect) {
    permCmdSelect.addEventListener('change', () => {
      const commandName = permCmdSelect.value;
      const moduleName = permModSelect ? permModSelect.value : '';

      if (!commandName) {
        activePermissionKey = `module:${moduleName}`;
        const nameElem = document.getElementById('perm-editing-command-name');
        if (nameElem) nameElem.textContent = `Module: ${moduleName.toUpperCase()}`;
      } else {
        activePermissionKey = commandName;
        const nameElem = document.getElementById('perm-editing-command-name');
        if (nameElem) nameElem.textContent = `Lệnh: /${commandName}`;
      }

      renderPermissionsRolesPickers(activePermissionKey);
    });
  }

  function renderPermissionsRolesPickers(commandName) {
    const rules = commandPermissions[commandName] || { allowedRoles: [], deniedRoles: [] };
    const allowedList = document.getElementById('allowed-roles-list');
    const deniedList = document.getElementById('denied-roles-list');

    if (!allowedList || !deniedList) return;
    allowedList.innerHTML = '';
    deniedList.innerHTML = '';

    if (!guildRoles || guildRoles.length === 0) {
      allowedList.innerHTML = '<p class="placeholder-text" style="color:var(--text-muted);">Không tìm thấy vai trò nào.</p>';
      deniedList.innerHTML = '<p class="placeholder-text" style="color:var(--text-muted);">Không tìm thấy vai trò nào.</p>';
      return;
    }

    guildRoles.forEach(role => {
      const dotHtml = role.color ? `<span class="role-color-dot" style="color: ${role.color}; background-color: ${role.color};"></span>` : '';

      const isAllowed = rules.allowedRoles?.includes(role.id) || false;
      const allowedItem = document.createElement('label');
      allowedItem.className = 'role-checkbox-item';
      allowedItem.innerHTML = `
        <input type="checkbox" data-role-id="${role.id}" class="allowed-checkbox" ${isAllowed ? 'checked' : ''} />
        <span class="role-checkbox-label" style="display:flex; align-items:center; gap:8px;">
          ${dotHtml}
          ${role.name}
        </span>
      `;
      allowedList.appendChild(allowedItem);

      const isDenied = rules.deniedRoles?.includes(role.id) || false;
      const deniedItem = document.createElement('label');
      deniedItem.className = 'role-checkbox-item';
      deniedItem.innerHTML = `
        <input type="checkbox" data-role-id="${role.id}" class="denied-checkbox" ${isDenied ? 'checked' : ''} />
        <span class="role-checkbox-label" style="display:flex; align-items:center; gap:8px;">
          ${dotHtml}
          ${role.name}
        </span>
      `;
      deniedList.appendChild(deniedItem);

      allowedItem.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          deniedItem.querySelector('input').checked = false;
        }
      });
      deniedItem.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          allowedItem.querySelector('input').checked = false;
        }
      });
    });
  }

  const savePermBtn = document.getElementById('btn-save-permissions');
  if (savePermBtn) {
    savePermBtn.addEventListener('click', async () => {
      const commandName = activePermissionKey;
      if (!commandName || !activeGuildId) return;

      const msgSpan = document.getElementById('permissions-status-msg');
      savePermBtn.disabled = true;
      if (msgSpan) {
        msgSpan.textContent = '🔄 Đang lưu cấu hình quyền...';
        msgSpan.className = 'status-msg';
      }

      const allowedRoles = [];
      document.querySelectorAll('.allowed-checkbox').forEach(cb => {
        if (cb.checked) allowedRoles.push(cb.dataset.roleId);
      });

      const deniedRoles = [];
      document.querySelectorAll('.denied-checkbox').forEach(cb => {
        if (cb.checked) deniedRoles.push(cb.dataset.roleId);
      });

      commandPermissions[commandName] = { allowedRoles, deniedRoles };

      try {
        const res = await fetch(`/api/guilds/${activeGuildId}/permissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: commandPermissions })
        });

        const data = await res.json();
        if (data.success) {
          if (msgSpan) {
            msgSpan.textContent = '✅ Đã lưu cấu hình quyền thành công!';
            msgSpan.className = 'status-msg success';
          }
          showToast('Đã lưu cấu hình quyền hạn thành công!', 'success');
        } else {
          if (msgSpan) {
            msgSpan.textContent = `❌ Lỗi: ${data.error || 'Không rõ nguyên nhân'}`;
            msgSpan.className = 'status-msg error';
          }
          showToast(`Lỗi: ${data.error}`, 'error');
        }
      } catch (err) {
        if (msgSpan) {
          msgSpan.textContent = '❌ Lỗi kết nối mạng.';
          msgSpan.className = 'status-msg error';
        }
        showToast('Lỗi kết nối mạng.', 'error');
      } finally {
        savePermBtn.disabled = false;
      }
    });
  }

  // 13. Discord CDN Image Upload Helper Widget
  const fileInput = document.getElementById('upload-image-file');
  const triggerBtn = document.getElementById('btn-trigger-upload');
  const urlInput = document.getElementById('uploaded-image-url');
  const copyBtn = document.getElementById('btn-copy-uploaded-url');
  const uploadStatus = document.getElementById('upload-status-msg');

  if (triggerBtn && fileInput) {
    triggerBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];

      uploadStatus.innerText = '🔄 Đang tải ảnh lên Discord CDN...';
      uploadStatus.className = 'status-msg';
      urlInput.value = '';
      copyBtn.disabled = true;
      triggerBtn.disabled = true;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          urlInput.value = data.url;
          copyBtn.disabled = false;
          triggerBtn.disabled = false;
          uploadStatus.innerText = '✅ Tải ảnh thành công!';
          uploadStatus.className = 'status-msg success';
          showToast('Đã tải ảnh lên Discord CDN thành công!', 'success');
        } else {
          triggerBtn.disabled = false;
          uploadStatus.innerText = `❌ Lỗi: ${data.error || 'Không rõ nguyên nhân'}`;
          uploadStatus.className = 'status-msg error';
          showToast(`Lỗi: ${data.error}`, 'error');
        }
      } catch {
        triggerBtn.disabled = false;
        uploadStatus.innerText = '❌ Lỗi kết nối mạng khi tải ảnh.';
        uploadStatus.className = 'status-msg error';
        showToast('Lỗi kết nối mạng.', 'error');
      }
    });
  }

  if (copyBtn && urlInput) {
    copyBtn.addEventListener('click', () => {
      urlInput.select();
      navigator.clipboard.writeText(urlInput.value);
      showToast('Đã copy Link ảnh Discord CDN vào bộ nhớ tạm!', 'success');
    });
  }
});
