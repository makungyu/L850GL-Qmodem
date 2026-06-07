'use strict';
'require view';
'require poll';
'require ui';
'require dom';
'require uci';
'require xmodem.xmodem as xmodem';

// Load CSS
document.head.appendChild(E('link', {
	'rel': 'stylesheet',
	'type': 'text/css',
	'href': L.resource('xmodem/xmodem-next.css')
}));

// Check if cbi-progressbar class exists
function hasCssClass(className) {
	var styleSheets = document.styleSheets;
	for (var i = 0; i < styleSheets.length; i++) {
		try {
			var rules = styleSheets[i].cssRules || styleSheets[i].rules;
			if (rules) {
				for (var j = 0; j < rules.length; j++) {
					if (rules[j].selectorText && rules[j].selectorText.indexOf(className) !== -1) {
						return true;
					}
				}
			}
		} catch(e) {
			// Cross-origin stylesheet, skip
		}
	}
	return false;
}

var progressbar_className = hasCssClass('.cbi-progressbar') ? 'cbi-progressbar' : 'compat-progressbar';

// LuciTable class for rendering modem info tables
var LuciTable = function() {
	this.rows = [];
	this.tbody = null;
	this.fieldset = null;
	this.initTable();
};

LuciTable.prototype = {
	initTable: function() {
		this.fieldset = E('fieldset', { 'class': 'cbi-section collapsible draggable', 'draggable': 'true' });
		//this.legend = E('legend', {});
		this.title_span = E('h2', { 'class': 'panel-title' });
		var table = E('table', { 'class': 'table' });
		this.tbody = E('tbody', { 'style': 'width: 100%' });
		
		table.appendChild(this.tbody);
		//this.fieldset.appendChild(this.legend);
		this.fieldset.appendChild(this.title_span);
		this.fieldset.appendChild(table);
	},

	setTitle: function(value) {
		// Translate class name
		var translatedValue = _(value);
		//this.legend.textContent = translatedValue;
		this.title_span.textContent = translatedValue;
	},

	newTr: function(data, index) {
		var type = data.type;
		switch(type) {
			case 'plain_text':
				var key = data.key;
				var value = data.value;
				if (key === 'LTE CA Details' && value != null) {
					value = value.toString().replace(/\\n/g, '\n');
				}
				var full_name = data.full_name || key;
				var extra_info = data.extra_info;
				
				// Translate full_name and extra_info
				var translatedName = _(full_name);
				var displayName = extra_info ? translatedName + ' (' + extra_info + ')' : translatedName;
				
				this.rows[index].left.textContent = displayName;
				this.rows[index].right.textContent = value;
				this.rows[index].right.style.whiteSpace = key === 'LTE CA Details' ? 'pre-line' : '';

				if (value == null || value == '') {
					this.rows[index].row.style.display = 'none';
				} else {
					this.rows[index].row.style.display = '';
				}
				break;
				
			case 'mode_switch':
				this.renderModeSwitch(data, index);
				break;

			case 'progress_bar':
				var key = data.key;
				var full_name = data.full_name || key;
				var extra_info = data.extra_info;
				var value = parseFloat(data.value);
				var min = parseFloat(data.min_value);
				var max = parseFloat(data.max_value);
				var unit = data.unit || '';
				// Per-metric bar width + quality colour/label, mirroring
				// 4IceG/luci-app-3ginfo-lite (3gdetail.js) exactly: same formulas,
				// sequential thresholds and colours (lime/yellow/darkorange/red).
				var qcolor = '', qlabel = '', percentage;
				var qk = (key || '').toUpperCase();
				if (qk.indexOf('RSRP') >= 0 || qk === 'RXLEV') {
					var vn = value; if (vn > -50) vn = -50; if (vn < -140) vn = -140;
					percentage = Math.floor(120 * (1 - (-50 - vn) / 70));
					if (value >= -80) { qcolor = 'lime'; qlabel = _('Very good'); }
					if (value >= -90 && value <= -79) { qcolor = 'yellow'; qlabel = _('Good'); }
					if (value >= -100 && value <= -89) { qcolor = 'darkorange'; qlabel = _('Weak'); }
					if (value < -100) { qcolor = 'red'; qlabel = _('Very weak'); }
				} else if (qk.indexOf('RSRQ') >= 0) {
					percentage = Math.floor(115 + 5 * value);
					if (value >= -10) { qcolor = 'lime'; qlabel = _('Excellent'); }
					if (value >= -15 && value <= -9) { qcolor = 'yellow'; qlabel = _('Good'); }
					if (value >= -20 && value <= -14) { qcolor = 'darkorange'; qlabel = _('Mid cell'); }
					if (value < -20) { qcolor = 'red'; qlabel = _('Cell edge'); }
				} else if (qk.indexOf('SINR') >= 0) {
					percentage = Math.floor(100 * (value + 21) / 61);
					if (value > 20) { qcolor = 'lime'; qlabel = _('Excellent'); }
					if (value >= 13 && value <= 20) { qcolor = 'yellow'; qlabel = _('Good'); }
					if (value > 0 && value <= 12) { qcolor = 'darkorange'; qlabel = _('Mid cell'); }
					if (value <= 0) { qcolor = 'red'; qlabel = _('Cell edge'); }
				} else if (qk.indexOf('RSSI') >= 0) {
					var vs = value; if (vs > -50) vs = -50; if (vs < -110) vs = -110;
					percentage = Math.floor(100 * (1 - (-50 - vs) / 60));
					if (value > -70) { qcolor = 'lime'; qlabel = _('Very good'); }
					if (value >= -85 && value <= -70) { qcolor = 'yellow'; qlabel = _('Good'); }
					if (value >= -100 && value <= -86) { qcolor = 'darkorange'; qlabel = _('Weak'); }
					if (value < -100) { qcolor = 'red'; qlabel = _('Very weak'); }
				} else {
					percentage = ((value - min) / (max - min)) * 100;
				}
				percentage = Math.max(0, Math.min(100, percentage));
				var title = data.value + (unit ? ' ' + unit : '') + (qlabel ? '  ' + qlabel : '');

				// Translate full_name and extra_info
				var translatedName = _(full_name);
				var displayName = extra_info ? translatedName + ' (' + extra_info + ')' : translatedName;

				this.rows[index].left.textContent = displayName;

				var progress_bar = E('div', {
					'class': progressbar_className,
					'title': title
				});
				var barStyle = 'width:' + percentage + '%';
				if (qcolor) barStyle += ';background-color:' + qcolor;
				var progress_bar_bar = E('div', { 'style': barStyle });
				progress_bar.appendChild(progress_bar_bar);

				this.rows[index].right.innerHTML = '';
				this.rows[index].right.appendChild(progress_bar);

				this.rows[index].row.style.display = '';
				break;
		}
	},

	renderModeSwitch: function(data, index) {
		var modemId = data.modem_id;
		var modes = data.modes || {};
		var availableModes = [];
		var currentMode = data.current_mode || '';

		for (var mode in modes) {
			availableModes.push(mode);
			if (modes[mode] === '1' || modes[mode] === 1)
				currentMode = mode;
		}

		var targetMode = currentMode === 'mbim' ? 'ncm' : 'mbim';
		if (availableModes.indexOf(targetMode) === -1) {
			for (var i = 0; i < availableModes.length; i++) {
				if (availableModes[i] !== currentMode) {
					targetMode = availableModes[i];
					break;
				}
			}
		}

		this.rows[index].left.textContent = _('USB Mode');
		this.rows[index].right.innerHTML = '';

		var modeText = currentMode ? currentMode.toUpperCase() : _('Unknown');

		var wrapper = E('div', {
			'style': 'display: inline-flex; align-items: center; gap: 10px; justify-content: flex-start;'
		});
		var current = E('strong', {
			'style': 'display: inline-block; text-align: left; white-space: nowrap;'
		}, modeText);
		wrapper.appendChild(current);

		if (modemId && targetMode && targetMode !== currentMode) {
			var button = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					button.disabled = true;
					button.textContent = _('Checking...');

					var wait = function(ms) {
						return new Promise(function(resolve) {
							window.setTimeout(resolve, ms);
						});
					};

					xmodem.getMode(modemId).then(function(modeResult) {
						if (modeResult && modeResult.mode && (modeResult.mode[targetMode] === '1' || modeResult.mode[targetMode] === 1)) {
							ui.addNotification(null, E('p', _('Selected mode is already active. No modem reboot needed.')), 'info');
							return null;
						}

						button.textContent = _('Stopping...');
						return xmodem.modemHang(modemId);
					}).then(function(hangResult) {
						if (hangResult === null)
							return null;
						button.textContent = _('Setting...');
						return xmodem.setMode(modemId, targetMode);
					}).then(function(result) {
						if (result === null)
							return null;
						if (!(result && result.result))
							throw new Error(_('Failed to set mode'));
						button.textContent = _('Rebooting...');
						return xmodem.doReboot(modemId, 'soft').then(function(rebootResult) {
							if (!(rebootResult && rebootResult.result))
								throw new Error(_('Mode set, but failed to reboot modem'));
							button.textContent = _('Scanning...');
							return wait(12000).then(function() {
								return xmodem.scanUsb();
							}).then(function() {
								button.textContent = _('Starting...');
								return wait(3000);
							}).then(function() {
								return xmodem.modemRedial(modemId);
							}).then(function() {
								ui.addNotification(null, E('p', _('Mode set successfully. Modem rebooted and dialer restarted.')), 'success');
							});
						});
					}).catch(function(e) {
						ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
					}).finally(function() {
						button.disabled = false;
						button.textContent = _('Switch to %s').format(targetMode.toUpperCase());
					});
				}
			}, _('Switch to %s').format(targetMode.toUpperCase()));
			wrapper.appendChild(button);
		}

		this.rows[index].right.appendChild(wrapper);
		this.rows[index].row.style.display = '';
	},
	setData: function(value) {
		if (value == null) return;
		
		if (Array.isArray(value)) {
			this.setArrayData(value);
		} else {
			this.setObjectData(value);
		}
	},

	setArrayData: function(value) {
		var row_length = this.rows.length;
		var value_length = value.length;
		
		// Add missing rows
		if (row_length < value_length) {
			for (var i = row_length; i < value_length; i++) {
				var row = E('tr', { 'class': 'tr' });
				var cell_left = E('td', { 'class': 'td left', 'width': '33%' });
				var cell_right = E('td', { 'class': 'td' });
				row.appendChild(cell_left);
				row.appendChild(cell_right);
				this.tbody.appendChild(row);
				
				this.rows.push({
					row: row,
					left: cell_left,
					right: cell_right
				});
			}
		}
		// Remove extra rows
		else if (row_length > value_length) {
			for (var i = value_length; i < row_length; i++) {
				this.tbody.removeChild(this.rows[i].row);
			}
			this.rows = this.rows.slice(0, value_length);
		}
		
		// Update row content
		for (var i = 0; i < value.length; i++) {
			this.newTr(value[i], i);
		}
	},

	setObjectData: function(value) {
		var row_length = this.rows.length;
		var value_length = Object.keys(value).length;
		
		// Add missing rows
		if (row_length < value_length) {
			for (var i = row_length; i < value_length; i++) {
				var row = E('tr', { 'class': 'tr' });
				var cell_left = E('td', { 'class': 'td left', 'width': '33%' });
				var cell_right = E('td', { 'class': 'td' });
				row.appendChild(cell_left);
				row.appendChild(cell_right);
				this.tbody.appendChild(row);
				
				this.rows.push({
					row: row,
					left: cell_left,
					right: cell_right
				});
			}
		}
		// Remove extra rows
		else if (row_length > value_length) {
			for (var i = value_length; i < row_length; i++) {
				this.tbody.removeChild(this.rows[i].row);
			}
			this.rows = this.rows.slice(0, value_length);
		}
		
		// Update row content
		var index = 0;
		for (var key in value) {
			this.rows[index].left.textContent = key;
			this.rows[index].right.textContent = value[key];
			index++;
		}
	}
};

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('xmodem')
		]);
	},

	getModemList: function() {
		var modems = [];
		var sections = uci.sections('xmodem', 'modem-device');
		
		sections.forEach(function(section) {
			if (section.state !== 'disabled' && section.at_port) {
				var name = section.name ? section.name.toUpperCase() : 'Unknown';
				var displayName = section.alias ? section.alias + ' (' + name + ')' : name;
				
				modems.push({
					id: section['.name'],
					name: displayName,
					at_port: section.at_port
				});
			}
		});
		
		return modems;
	},

	// Get section order from localStorage
	getSectionOrder: function(modemId) {
		var key = 'xmodem_section_order_' + modemId;
		var order = localStorage.getItem(key);
		return order ? JSON.parse(order) : [];
	},

	// Save section order to localStorage
	saveSectionOrder: function(modemId, order) {
		var key = 'xmodem_section_order_' + modemId;
		localStorage.setItem(key, JSON.stringify(order));
	},

	// Get collapsed state from localStorage
	getCollapsedState: function(modemId, className) {
		var key = 'xmodem_collapsed_' + modemId + '_' + className;
		return localStorage.getItem(key) === 'true';
	},

	// Save collapsed state to localStorage
	saveCollapsedState: function(modemId, className, isCollapsed) {
		var key = 'xmodem_collapsed_' + modemId + '_' + className;
		localStorage.setItem(key, isCollapsed ? 'true' : 'false');
	},

	// Attach collapse and drag handlers to a section
	attachSectionHandlers: function(fieldset, className, modemId, infoContainer) {
		var self = this;
		
		// Collapse/expand handler
		var legend = fieldset.querySelector('legend');
		var title = fieldset.querySelector('.panel-title');
		
		var toggleCollapse = function(e) {
			// Don't toggle if dragging
			if (fieldset.classList.contains('dragging')) {
				return;
			}
			
			fieldset.classList.toggle('collapsed');
			var isCollapsed = fieldset.classList.contains('collapsed');
			self.saveCollapsedState(modemId, className, isCollapsed);
		};
		
		if (legend) legend.addEventListener('click', toggleCollapse);
		if (title) title.addEventListener('click', toggleCollapse);
		
		// Drag and drop handlers
		fieldset.addEventListener('dragstart', function(e) {
			fieldset.classList.add('dragging');
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', className);
		});
		
		fieldset.addEventListener('dragend', function(e) {
			fieldset.classList.remove('dragging');
			// Remove all drag-over classes
			var sections = infoContainer.querySelectorAll('.cbi-section.draggable');
			sections.forEach(function(section) {
				section.classList.remove('drag-over');
			});
		});
		
		fieldset.addEventListener('dragover', function(e) {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
			
			var draggingElement = infoContainer.querySelector('.dragging');
			if (draggingElement && draggingElement !== fieldset) {
				fieldset.classList.add('drag-over');
			}
		});
		
		fieldset.addEventListener('dragleave', function(e) {
			fieldset.classList.remove('drag-over');
		});
		
		fieldset.addEventListener('drop', function(e) {
			e.preventDefault();
			fieldset.classList.remove('drag-over');
			
			var draggedClassName = e.dataTransfer.getData('text/plain');
			if (draggedClassName === className) {
				return;
			}
			
			// Get all sections in current order
			var sections = Array.from(infoContainer.querySelectorAll('.cbi-section.draggable'));
			var draggedSection = infoContainer.querySelector('.dragging');
			
			// Reorder in DOM
			if (draggedSection) {
				infoContainer.insertBefore(draggedSection, fieldset);
			}
			
			// Save new order
			var newOrder = Array.from(infoContainer.querySelectorAll('.cbi-section.draggable')).map(function(section) {
				// Extract className from legend or title
				var legend = section.querySelector('legend');
				var title = section.querySelector('.panel-title');
				return (legend && legend.textContent) || (title && title.textContent) || '';
			}).filter(function(name) {
				return name !== '';
			});
			
			self.saveSectionOrder(modemId, newOrder);
		});
	},

	updateModemInfo: function(modemId, tables_map, infoContainer, updateTimeElement) {
		var self = this;
		
		// Show loading state
		if (Object.keys(tables_map).length === 0) {
			dom.content(infoContainer, E('div', { 'class': 'spinning' }, _('Loading modem information...')));
		}
		
		// Fetch all modem info
		Promise.all([
			xmodem.getBaseInfo(modemId),
			xmodem.getSimInfo(modemId),
			xmodem.getNetworkInfo(modemId),
			xmodem.getMode(modemId)
		]).then(function(results) {
			// Merge all modem_info arrays
			var all_info = [];
			for (var i = 0; i < results.length; i++) {
				if (results[i] && results[i].modem_info) {
					all_info = all_info.concat(results[i].modem_info);
				}
			}
			
			var modeData = results[results.length - 1];
			if (modeData && modeData.mode) {
				var currentMode = '';
				for (var mode in modeData.mode) {
					if (modeData.mode[mode] === '1' || modeData.mode[mode] === 1) {
						currentMode = mode;
						break;
					}
				}
				all_info.push({
					type: 'mode_switch',
					'class': 'Base Information',
					key: 'Modem Mode',
					modem_id: modemId,
					modes: modeData.mode,
					current_mode: currentMode
				});
			}

			// Group by class
			var grouped = {};
			all_info.forEach(function(entry) {
				if (entry.type === 'warning_message') {
					// Handle warning messages
					return;
				}
				
				var className = entry['class'] || 'General';
				if (!grouped[className]) {
					grouped[className] = [];
				}
				grouped[className].push(entry);
			});

			// Clear loading animation if present
			var loadingDiv = infoContainer.querySelector('.spinning');
			if (loadingDiv) {
				infoContainer.removeChild(loadingDiv);
			}

			// Remove obsolete tables from DOM and map
			for (var existingClass in tables_map) {
				if (!grouped[existingClass]) {
					if (tables_map[existingClass].fieldset.parentNode) {
						infoContainer.removeChild(tables_map[existingClass].fieldset);
					}
					delete tables_map[existingClass];
				}
			}

			// Get section order from localStorage
			var sectionOrder = self.getSectionOrder(modemId);
			var orderedClasses = [];
			
			// First add classes in saved order
			sectionOrder.forEach(function(className) {
				if (grouped[className]) {
					orderedClasses.push(className);
				}
			});
			
			// Then add any new classes not in saved order
			for (var className in grouped) {
				if (orderedClasses.indexOf(className) === -1) {
					orderedClasses.push(className);
				}
			}
			
			// Update or create tables in order
			orderedClasses.forEach(function(className) {
				if (!tables_map[className]) {
					tables_map[className] = new LuciTable();
					infoContainer.appendChild(tables_map[className].fieldset);
					self.attachSectionHandlers(tables_map[className].fieldset, className, modemId, infoContainer);
				}
				tables_map[className].setTitle(className);
				tables_map[className].setData(grouped[className]);
				
				// Restore collapsed state
				var collapsedState = self.getCollapsedState(modemId, className);
				if (collapsedState) {
					tables_map[className].fieldset.classList.add('collapsed');
				} else {
					tables_map[className].fieldset.classList.remove('collapsed');
				}
			});
			
			// Update refresh time
			if (updateTimeElement) {
				var now = new Date();
				var timeStr = now.getFullYear() + '-' + 
					String(now.getMonth() + 1).padStart(2, '0') + '-' + 
					String(now.getDate()).padStart(2, '0') + ' ' + 
					String(now.getHours()).padStart(2, '0') + ':' + 
					String(now.getMinutes()).padStart(2, '0') + ':' + 
					String(now.getSeconds()).padStart(2, '0');
				updateTimeElement.textContent = _('Last update') + ': ' + timeStr;
			}
		}).catch(function(e) {
			console.error('Error fetching modem info:', e);
			dom.content(infoContainer, E('div', { 'class': 'alert-message warning' },
				_('Error loading modem information: %s').format(e.message)));
		});
	},

	render: function() {
		var self = this;
		var modems = this.getModemList();
		
		if (modems.length === 0) {
			return E('div', { 'class': 'alert-message warning' }, 
				_('No modems configured or all modems are disabled.'));
		}

		var container = E('div', { 'class': 'cbi-map' });
		
		// Create modem selector section
		var selectorSection = E('fieldset', { 'class': 'cbi-section' });
		var selectorTable = E('table', { 'class': 'table' });
		var selectorBody = E('tbody', {});
		var selectorRow = E('tr', { 'class': 'tr' });
		var labelCell = E('td', { 'class': 'td', 'width': '33%' }, _('Modem Name'));
		var selectCell = E('td', { 'class': 'td' });
		
		// Create select dropdown
		var select = E('select', {
			'class': 'cbi-input-select',
			'id': 'modem_selector'
		});
		
		modems.forEach(function(modem) {
			select.appendChild(E('option', { 'value': modem.id }, modem.name));
		});
		
		selectCell.appendChild(select);
		selectorRow.appendChild(labelCell);
		selectorRow.appendChild(selectCell);
		selectorBody.appendChild(selectorRow);
		selectorTable.appendChild(selectorBody);
		selectorSection.appendChild(selectorTable);
		container.appendChild(selectorSection);
		
		// Create update time display
		var updateTimeSection = E('fieldset', { 'class': 'cbi-section' });
		var updateTimeDiv = E('div', { 
			'style': 'text-align: right; padding: 5px; color: #888;',
			'id': 'update_time_display'
		}, _('Last update') + ': -');
		updateTimeSection.appendChild(updateTimeDiv);
		container.appendChild(updateTimeSection);
		
		// Create info container
		var infoContainer = E('div', { 'id': 'modem_info_container' });
		container.appendChild(infoContainer);
		
		// Tables map to store LuciTable instances
		var tables_map = {};
		
		// Update function
		var updateInfo = function(clearTables) {
			var selectedModem = select.value;
			
			// Clear tables when switching modem
			if (clearTables) {
				for (var className in tables_map) {
					if (tables_map[className].fieldset.parentNode) {
						infoContainer.removeChild(tables_map[className].fieldset);
					}
				}
				tables_map = {};
			}
			
			self.updateModemInfo(selectedModem, tables_map, infoContainer, updateTimeDiv);
		};
		
		// Selector change handler
		select.addEventListener('change', function() {
			updateInfo(true); // Clear tables when switching
		});
		
		// Initial update
		updateInfo(false);
		
		// Start polling (every 10 seconds)
		poll.add(function() {
			var selectedModem = select.value;
			self.updateModemInfo(selectedModem, tables_map, infoContainer, updateTimeDiv);
		}, 10);
		
		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
