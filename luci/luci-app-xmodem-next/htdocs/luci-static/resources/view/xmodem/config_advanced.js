'use strict';
'require view';
'require ui';
'require dom';
'require xmodem.xmodem as xmodem';

return view.extend({
	load: function() {
		return xmodem.getModemSections();
	},

	render: function(modems) {
		if (!modems || modems.length === 0) {
			return E('div', { 'class': 'alert-message warning' }, 
				_('No modem configured.'));
		}

		var container = E('div', { 'class': 'cbi-map' });
		// Create modem selector section
		var selectorSection = E('fieldset', { 'class': 'cbi-section' });
		var selectorTable = E('table', { 'class': 'table' });
		var selectorBody = E('tbody', {});
		var selectorRow = E('tr', { 'class': 'tr' });
		var labelCell = E('td', { 'class': 'td left', 'width': '33%' }, _('Modem Name'));
		var selectCell = E('td', { 'class': 'td' });
		
		// Create select dropdown
		var select = E('select', {
			'class': 'cbi-input-select',
			'id': 'modem_selector'
		});
		
		modems.forEach(function(modem) {
			if (modem.enabled) {
				select.appendChild(E('option', { 'value': modem.id }, modem.name));
			}
		});
		
		selectCell.appendChild(select);
		selectorRow.appendChild(labelCell);
		selectorRow.appendChild(selectCell);
		selectorBody.appendChild(selectorRow);
		selectorTable.appendChild(selectorBody);
		selectorSection.appendChild(selectorTable);
		container.appendChild(selectorSection);

		// Create tab container
		var tabContainer = E('div', { 'id': 'tab_container' });
		container.appendChild(tabContainer);

		var self = this;
		
		// Update function to show selected modem's tabs
		var updateTabs = function() {
			var selectedId = select.value;
			var selectedModem = modems.find(function(m) { return m.id === selectedId; });
			
			if (selectedModem) {
				dom.content(tabContainer, null);
				dom.append(tabContainer, E('div', { 'class': 'spinning' }, _('Loading...')));
				
				// Get disabled features for the modem
				xmodem.getDisabledFeatures(selectedModem.id).then(function(result) {
					var disabledFeatures = result.disabled_features || [];
					dom.content(tabContainer, self.createTabInterface(selectedModem, disabledFeatures));
				}).catch(function(e) {
					dom.content(tabContainer, E('div', { 'class': 'alert-message warning' }, 
						_('Error loading features: %s').format(e.message)));
				});
			}
		};

		// Selector change handler
		select.addEventListener('change', updateTabs);

		// Initial display
		updateTabs();

		return container;
	},

	createTabInterface: function(modem, disabledFeatures) {
		var self = this;
		var container = E('div', {});
		
		// Define all available features
		var features = {
			'ATDebug': {
				name: _('AT Debug'),
				handler: function() { return self.createAtInterface(modem); }
			},
			'RatPrefer': {
				name: _('Network Preference'),
				handler: function() { return self.createRatPreferTab(modem); }
			},
			'NeighborCell': {
				name: _('Lock PCI/EARFCN'),
				handler: function() { return self.createNeighborCellTab(modem); }
			},
			'LockBand': {
				name: _('Lock Band'),
				handler: function() { return self.createLockBandTab(modem); }
			},
			'SIMSwitch': {
				name: _('SIM Switch'),
				handler: function() { return self.createSimSwitchInterface(modem); }
			},
			'RebootModem': {
				name: _('Reboot Modem'),
				handler: function() { return self.createRebootModemTab(modem); }
			}
		};
		// Filter out disabled features
		var enabledFeatures = {};
		for (var key in features) {
			if (!disabledFeatures.includes(key)) {
				enabledFeatures[key] = features[key];
			}
		}

		// If no features enabled, show message
		if (Object.keys(enabledFeatures).length === 0) {
			return E('div', { 'class': 'alert-message warning' }, 
				_('No features available for this modem.'));
		}

		// Create tab menu
		var tabMenu = E('ul', { 'class': 'cbi-tabmenu' });
		var tabContentContainer = E('div', { 'id': 'tab_content_container' });

		var firstTab = null;
		var tabContents = {};

		Object.keys(enabledFeatures).forEach(function(key, index) {
			var feature = enabledFeatures[key];
			
			// Create LuCI-style tab item with an anchor for proper theme spacing
			var tabButton = E('li', {
				'class': index === 0 ? 'cbi-tab' : 'cbi-tab-disabled',
				'data-tab': key
			});
			var tabLink = E('a', {
				'href': '#',
				'click': function(ev) {
					ev.preventDefault();
					// Switch active tab
					tabMenu.querySelectorAll('li').forEach(function(tab) {
						tab.classList.remove('cbi-tab');
						tab.classList.add('cbi-tab-disabled');
					});
					tabButton.classList.remove('cbi-tab-disabled');
					tabButton.classList.add('cbi-tab');
					
					// Show corresponding content
					for (var k in tabContents) {
						tabContents[k].style.display = 'none';
					}
					tabContents[key].style.display = '';
				}
			}, feature.name);
			tabButton.appendChild(tabLink);
			
			tabMenu.appendChild(tabButton);
			
			// Create tab content (lazy loaded)
			var tabContent = E('div', {
				'class': 'cbi-section-node',
				'data-tab-content': key,
				'style': index === 0 ? '' : 'display: none;'
			});
			
			// Lazy load content when first shown
			if (index === 0) {
				dom.append(tabContent, feature.handler());
			} else {
				// Add lazy loading
				tabButton.addEventListener('click', function() {
					if (!tabContent.dataset.loaded) {
						dom.content(tabContent, feature.handler());
						tabContent.dataset.loaded = 'true';
					}
				}, { once: false });
			}
			
			tabContents[key] = tabContent;
		});

		container.appendChild(tabMenu);
		
		// Append all tab contents
		for (var key in tabContents) {
			tabContentContainer.appendChild(tabContents[key]);
		}
		container.appendChild(tabContentContainer);

		return container;
	},

	// Inline, persistent success/failure confirmation shown next to an action button
	showActionResult: function(anchorEl, ok, msg) {
		if (!anchorEl || !anchorEl.parentNode) return;
		var prev = anchorEl.parentNode.querySelector('.xmodem-action-result');
		if (prev) prev.parentNode.removeChild(prev);
		anchorEl.parentNode.appendChild(E('div', {
			'class': 'xmodem-action-result alert-message ' + (ok ? 'success' : 'danger'),
			'style': 'margin-top: 8px;'
		}, [ E('strong', {}, ok ? '\u2713 ' : '\u2717 '), msg ]));
	},

	createAtInterface: function(modem) {
		var self = this;
		var container = E('div', { 'class': 'cbi-section-node' });

		// AT Port Configuration
		var portSection = E('div', { 'class': 'cbi-value' });
		portSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Available AT Ports')));
		var portInfo = E('div', { 'class': 'cbi-value-field' });
		portInfo.appendChild(E('div', { 'class': 'spinning' }, _('Loading...')));
		portSection.appendChild(portInfo);
		container.appendChild(portSection);

		// Load AT configuration
		xmodem.getAtCfg(modem.id).then(function(cfg) {
			if (!cfg || !cfg.at_cfg) {
				dom.content(portInfo, _('Failed to load AT configuration'));
				return;
			}

			var info = [];
			info.push(E('div', {}, [
				E('strong', {}, _('Current Port') + ': '),
				E('span', {}, cfg.at_cfg.using_port || 'N/A')
			]));

			if (cfg.at_cfg.ports && cfg.at_cfg.ports.length > 0) {
				info.push(E('div', {}, [
					E('strong', {}, _('Configured Ports') + ': '),
					E('span', {}, cfg.at_cfg.ports.join(', '))
				]));
			}

			if (cfg.at_cfg.other_ttys && cfg.at_cfg.other_ttys.length > 0) {
				info.push(E('div', {}, [
					E('strong', {}, _('Detected Ports') + ': '),
					E('span', {}, cfg.at_cfg.other_ttys.join(', '))
				]));
			}

			dom.content(portInfo, info);

			// Port selection dropdown
			var ports = [];
			if (cfg.at_cfg.ports) ports = ports.concat(cfg.at_cfg.ports);
			if (cfg.at_cfg.other_ttys) ports = ports.concat(cfg.at_cfg.other_ttys);

			var portSelectSection = E('div', { 'class': 'cbi-value' });
			portSelectSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Select AT Port')));
			var portSelectField = E('div', { 'class': 'cbi-value-field' });
			
			var select = new ui.Dropdown(cfg.at_cfg.using_port || (ports.length > 0 ? ports[0] : ''),
				ports.reduce(function(obj, port) {
					obj[port] = port;
					return obj;
				}, {}), {
					id: 'at_port_' + modem.id,
					sort: false
				});
			
			portSelectField.appendChild(select.render());
			portSelectSection.appendChild(portSelectField);
			container.appendChild(portSelectSection);

			// Use Ubus flag option
			var ubusSection = E('div', { 'class': 'cbi-value' });
			ubusSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Use Ubus AT Daemon')));
			var ubusField = E('div', { 'class': 'cbi-value-field' });
			
			var ubusCheckbox = E('input', {
				'type': 'checkbox',
				'id': 'use_ubus_' + modem.id,
				'checked': modem.use_ubus === '1'
			});
			
			ubusField.appendChild(ubusCheckbox);
			ubusField.appendChild(document.createTextNode(' '));
			ubusField.appendChild(E('span', {}, _('Enable to use Ubus AT daemon instead of direct serial port access')));
			ubusSection.appendChild(ubusField);
			container.appendChild(ubusSection);

			// AT Command input
			var cmdSection = E('div', { 'class': 'cbi-value' });
			cmdSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('AT Command')));
			var cmdField = E('div', { 'class': 'cbi-value-field' });
			var cmdInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'id': 'at_command_' + modem.id,
				'placeholder': 'AT+CIMI'
			});
			cmdField.appendChild(cmdInput);
			cmdSection.appendChild(cmdField);
			container.appendChild(cmdSection);

			// Response area
			var responseSection = E('div', { 'class': 'cbi-value' });
			responseSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Response')));
			var responseField = E('div', { 'class': 'cbi-value-field' });
			
			var responseDiv = E('textarea', {
				'id': 'at_response_' + modem.id,
				'style': 'padding: 10px; overflow-y: auto; font-family: monospace; white-space: pre-wrap; width: 80%;',
				'rows': 20,
				'readonly': 'readonly',
			}, _('Click "Send AT Command" to execute'));

			var sendBtn = E('button', {
				'class': 'btn cbi-button-action',
				'click': function() {
					var port = document.getElementById('at_port_' + modem.id).value;
					var cmd = document.getElementById('at_command_' + modem.id).value.trim();
					var useUbus = document.getElementById('use_ubus_' + modem.id).checked ? '1' : '0';

					if (!cmd) {
						responseDiv.textContent = _('Error: Please enter AT command');
						return;
					}

					responseDiv.textContent = _('Sending command...');

					// Use the use_ubus flag when sending AT command
					xmodem.sendAt(modem.id, port, cmd, useUbus).then(function(result) {
						if (result && result.at_cfg) {
							var text = '';
							text += 'Status: ' + (result.at_cfg.status === '1' ? 'Success' : 'Failed') + '\n';
							text += 'Command: ' + (result.at_cfg.cmd || '') + '\n';
							text += 'Response:\n' + (result.at_cfg.res || 'No response');
							responseDiv.textContent = text;
						} else {
							responseDiv.textContent = _('No response received');
						}
					}).catch(function(e) {
						responseDiv.textContent = _('Error: %s').format(e.message);
					});
				}
			}, _('Send AT Command'));

			responseField.appendChild(sendBtn);
			responseField.appendChild(E('br'));
			responseField.appendChild(E('br'));
			responseField.appendChild(responseDiv);
			responseSection.appendChild(responseField);
			container.appendChild(responseSection);

			// Quick commands
			if (cfg.at_cfg.cmds && cfg.at_cfg.cmds.length > 0) {
				var quickSection = E('div', { 'class': 'cbi-value' });
				quickSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Quick Commands')));
				var quickField = E('div', { 'class': 'cbi-value-field cbi-section-actions' });
				
				cfg.at_cfg.cmds.forEach(function(cmd) {
					if (cmd.name && cmd.value) {
						quickField.appendChild(E('button', {
							'class': 'btn cbi-button-action',
							'click': function() {
								document.getElementById('at_command_' + modem.id).value = cmd.value;
							}
						}, cmd.name));
						quickField.appendChild(document.createTextNode(' '));
					}
				});
				
				quickSection.appendChild(quickField);
				container.appendChild(quickSection);
			}
		}).catch(function(e) {
			dom.content(portInfo, _('Error loading AT configuration: %s').format(e.message));
		});

		return container;
	},

	createSimSwitchInterface: function(modem) {
		var self = this;
		var container = E('div', { 'class': 'cbi-section-node' });

		// Status section - shows support and current slot
		var statusSection = E('div', { 'class': 'cbi-value' });
		statusSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('SIM Switch Status')));
		var statusField = E('div', { 'class': 'cbi-value-field' });
		statusField.appendChild(E('div', { 'class': 'spinning' }, _('Loading...')));
		statusSection.appendChild(statusField);
		container.appendChild(statusSection);

		// SIM slot buttons container
		var buttonsSection = E('div', { 'class': 'cbi-value' });
		buttonsSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Select SIM Slot')));
		var buttonsField = E('div', { 'class': 'cbi-value-field' });
		buttonsSection.appendChild(buttonsField);
		container.appendChild(buttonsSection);

		// Result section
		var resultSection = E('div', { 'class': 'cbi-value', 'id': 'sim_result_section_' + modem.id, 'style': 'display: none;' });
		resultSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Result')));
		var resultField = E('div', { 'class': 'cbi-value-field', 'id': 'sim_result_' + modem.id });
		resultSection.appendChild(resultField);
		container.appendChild(resultSection);

		// Load SIM switch support and current slot
		Promise.all([
			xmodem.callGetSimSwitchCapabilities(modem.id),
			xmodem.getSimSlot(modem.id)
		]).then(function(results) {
			var supportResult = results[0];
			var slotResult = results[1];
			
			var supported = supportResult && supportResult.supportSwitch === '1';
			var currentSlot = slotResult && slotResult.sim_slot ? slotResult.sim_slot : 'N/A';
			var slots = (supportResult && Array.isArray(supportResult.simSlots)) ? supportResult.simSlots : [];
			var hideButtons = !supported || currentSlot === 'N/A' || slots.length === 0;
			
			// Update status
			var statusInfo = [];
			statusInfo.push(E('div', {}, [
				E('strong', {}, _('Support') + ': '),
				E('span', { 'class': supported ? 'label-success' : 'label-warning' }, 
					supported ? _('Supported') : _('Not Supported'))
			]));
			statusInfo.push(E('div', { 'style': 'margin-top: 5px;' }, [
				E('strong', {}, _('Current SIM Slot') + ': '),
				E('span', {}, self.formatSlotDisplay(currentSlot))
			]));
			
			dom.content(statusField, statusInfo);
			
			// Create SIM slot buttons dynamically based on capabilities
			var btns = [];
			if (!hideButtons) {
				slots.forEach(function(slotVal, idx) {
					var label = _('Slot %s').format(slotVal);
					var btn = E('button', {
						'class': 'btn cbi-button' + (currentSlot == slotVal ? ' cbi-button-positive' : ' cbi-button-action'),
						'data-slot': slotVal,
						'click': supported ? function() { self.switchSimSlot(modem.id, slotVal, btns); } : null,
						'style': (!supported ? 'opacity: 0.5; cursor: not-allowed;' : '') + (idx > 0 ? ' margin-left: 10px;' : '')
					}, label);
					btns.push(btn);
				});
			}
			dom.content(buttonsField, btns);
			
			if (!supported) {
				buttonsField.appendChild(E('div', { 'style': 'margin-top: 10px; color: #999;' }, 
					_('This modem does not support SIM switching.')));
			}
			
			// Display ExtraInfo if available
			var extraInfo = supportResult && supportResult.ExtraInfo;
			if (extraInfo) {
				statusInfo.push(E('div', { 'style': 'margin-top: 5px; color: #f0ad4e;' }, [
					E('strong', {}, _('Note') + ': '),
					E('span', {}, _(extraInfo))
				]));
				dom.content(statusField, statusInfo);
			}
			
		}).catch(function(e) {
			dom.content(statusField, E('span', { 'class': 'error' }, 
				_('Error loading SIM switch information: %s').format(e.message)));
			
			// No buttons on error; show info only
			dom.content(buttonsField, []);
		});

		return container;
	},

	formatSlotDisplay: function(slot) {
		if (!slot)
			return 'N/A';
		return _('Slot %s').format(slot);
	},

	switchSimSlot: function(modemId, slot, buttons) {
		var self = this;
		var resultSection = document.getElementById('sim_result_section_' + modemId);
		var resultField = document.getElementById('sim_result_' + modemId);
		
		// Show loading state
		resultSection.style.display = '';
		dom.content(resultField, E('div', { 'class': 'spinning' }, _('Switching SIM slot...')));
		
		// Disable buttons during switch
		(buttons || []).forEach(function(b){ b.disabled = true; b.style.opacity = '0.5'; });
		
		xmodem.setSimSlot(modemId, slot).then(function(result) {
			// Re-enable buttons
			(buttons || []).forEach(function(b){ b.disabled = false; b.style.opacity = ''; });
			
			if (result && result.result) {
				dom.content(resultField, E('div', { 'class': 'alert-message success' }, [
					E('span', {}, _('SIM slot switched to Slot %s successfully.').format(slot)),
					E('br'),
					E('span', { 'style': 'font-size: 0.9em;' }, 
						_('Note: Some modems may require a reboot for the change to take effect.'))
				]));
				
				// Update button styles to reflect new slot
				(buttons || []).forEach(function(b){
					var bs = b.getAttribute('data-slot');
					b.className = 'btn cbi-button' + (bs == slot ? ' cbi-button-positive' : ' cbi-button-action');
				});
			} else {
				dom.content(resultField, E('div', { 'class': 'alert-message warning' }, 
					_('Failed to switch SIM slot. Please check modem status.')));
			}
		}).catch(function(e) {
			// Re-enable buttons
			(buttons || []).forEach(function(b){ b.disabled = false; b.style.opacity = ''; });
			
			dom.content(resultField, E('div', { 'class': 'alert-message error' }, 
				_('Error switching SIM slot: %s').format(e.message)));
		});
	},

	createRatPreferTab: function(modem) {
		var self = this;
		var container = E('fieldset', { 'class': 'cbi-section' });
		var legend = E('legend', {}, _('Network Preference Configuration'));
		container.appendChild(legend);

		var description = E('div', { 'class': 'cbi-section-descr' }, 
			_('Configure network preference (5G/4G/3G priority). Changes may require modem restart.'));
		container.appendChild(description);

		// Current network preference display
		var currentPrefSection = E('div', { 'class': 'cbi-value' });
		currentPrefSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Current Preference')));
		var currentPrefField = E('div', { 'class': 'cbi-value-field' });
		var currentPrefValue = E('strong', { 'id': 'current_pref_' + modem.id }, _('Loading...'));
		currentPrefField.appendChild(currentPrefValue);
		currentPrefSection.appendChild(currentPrefField);
		container.appendChild(currentPrefSection);

		// Network selection section
		var prefSelectionSection = E('div', { 'class': 'cbi-value' });
		prefSelectionSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Select Networks')));
		var prefSelectionField = E('div', { 
			'class': 'cbi-value-field',
			'id': 'pref_selection_' + modem.id
		});
		prefSelectionField.appendChild(E('div', { 'class': 'spinning' }, _('Loading available networks...')));
		prefSelectionSection.appendChild(prefSelectionField);
		container.appendChild(prefSelectionSection);

		// Submit button section
		var buttonSection = E('div', { 'class': 'cbi-value' });
		buttonSection.appendChild(E('label', { 'class': 'cbi-value-title' }, ''));
		var buttonField = E('div', { 'class': 'cbi-value-field' });
		var submitButton = E('button', {
			'class': 'btn cbi-button-action',
			'id': 'submit_pref_' + modem.id,
			'disabled': true,
			'click': function() {
				var selectedNetworks = [];
				var checkboxes = document.querySelectorAll('input[name="network_' + modem.id + '"]:checked');
				checkboxes.forEach(function(cb) {
					selectedNetworks.push(cb.value);
				});

				if (selectedNetworks.length === 0) {
					ui.addNotification(null, E('p', _('Please select at least one network type')), 'error');
					return;
				}

				submitButton.disabled = true;
				submitButton.textContent = _('Applying...');

				xmodem.setNetworkPrefer(modem.id, selectedNetworks).then(function(result) {
					if (result && result.result) {
						self.showActionResult(submitButton, true, _('Network preference set to: %s').format(selectedNetworks.join(', ')));
						ui.addNotification(null, E('p', _('Network preference set successfully')), 'success');
						// Refresh the preference display
						self.loadNetworkPrefer(modem, currentPrefValue, prefSelectionField, submitButton);
					} else {
						self.showActionResult(submitButton, false, _('Failed to set network preference'));
						ui.addNotification(null, E('p', _('Failed to set network preference')), 'error');
						submitButton.disabled = false;
						submitButton.textContent = _('Apply');
					}
				}).catch(function(e) {
					self.showActionResult(submitButton, false, _('Error: %s').format(e.message));
					ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
					submitButton.disabled = false;
					submitButton.textContent = _('Apply');
				});
			}
		}, _('Apply'));
		buttonField.appendChild(submitButton);
		buttonSection.appendChild(buttonField);
		container.appendChild(buttonSection);

		// Load current network preference
		self.loadNetworkPrefer(modem, currentPrefValue, prefSelectionField, submitButton);

		return container;
	},

	loadNetworkPrefer: function(modem, currentPrefValue, prefSelectionField, submitButton) {
		xmodem.getNetworkPrefer(modem.id).then(function(result) {
			if (!result || !result.network_prefer) {
				currentPrefValue.textContent = _('Error loading preference');
				dom.content(prefSelectionField, E('em', {}, _('Failed to load network preferences')));
				return;
			}

			var networkPrefer = result.network_prefer;
			var currentNetworks = [];
			var availableNetworks = [];

			// Find current and available networks
			for (var network in networkPrefer) {
				availableNetworks.push(network);
				if (networkPrefer[network] === '1' || networkPrefer[network] === 1) {
					currentNetworks.push(network);
				}
			}

			// Update current preference display
			currentPrefValue.textContent = currentNetworks.length > 0 ? currentNetworks.join(', ') : _('None');

			// Create checkboxes for network selection
			if (availableNetworks.length === 0) {
				dom.content(prefSelectionField, E('em', {}, _('No network types available')));
				return;
			}

			var checkboxContainer = E('div', { 'class': 'cbi-value-field' });
			availableNetworks.forEach(function(network) {
				var checkboxWrapper = E('div', { 'style': 'margin: 5px 0;' });
				var checkbox = E('input', {
					'type': 'checkbox',
					'name': 'network_' + modem.id,
					'value': network,
					'id': 'network_' + modem.id + '_' + network,
					'checked': networkPrefer[network] === '1' || networkPrefer[network] === 1 ? 'checked' : null
				});
				var label = E('label', {
					'for': 'network_' + modem.id + '_' + network,
					'style': 'margin-left: 5px;'
				}, network);
				
				checkboxWrapper.appendChild(checkbox);
				checkboxWrapper.appendChild(label);
				checkboxContainer.appendChild(checkboxWrapper);
			});

			dom.content(prefSelectionField, checkboxContainer);
			submitButton.disabled = false;

		}).catch(function(e) {
			currentPrefValue.textContent = _('Error');
			dom.content(prefSelectionField, E('div', { 'class': 'alert-message error' },
				_('Error loading network preference: %s').format(e.message)));
		});
	},

	createImeiTab: function(modem) {
		var self = this;
		var container = E('fieldset', { 'class': 'cbi-section' });
		var legend = E('legend', {}, _('IMEI Configuration'));
		container.appendChild(legend);

		var description = E('div', { 'class': 'cbi-section-descr' }, 
			_('View and modify the modem IMEI number. IMEI must be 15 digits. Changes require modem reboot to take effect.'));
		container.appendChild(description);

		// Current IMEI display
		var currentImeiSection = E('div', { 'class': 'cbi-value' });
		currentImeiSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Current IMEI')));
		var currentImeiField = E('div', { 'class': 'cbi-value-field' });
		var currentImeiValue = E('strong', { 
			'id': 'current_imei_' + modem.id,
			'style': 'font-family: monospace; font-size: 1.1em;'
		}, _('Loading...'));
		currentImeiField.appendChild(currentImeiValue);
		currentImeiSection.appendChild(currentImeiField);
		container.appendChild(currentImeiSection);

		// New IMEI input section
		var newImeiSection = E('div', { 'class': 'cbi-value' });
		newImeiSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('New IMEI')));
		var newImeiField = E('div', { 'class': 'cbi-value-field' });
		var imeiInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'id': 'imei_input_' + modem.id,
			'placeholder': '123456789012345',
			'maxlength': '15',
			'pattern': '[0-9]{15}',
			'style': 'font-family: monospace;'
		});
		
		// Add input validation
		imeiInput.addEventListener('input', function() {
			// Remove non-numeric characters
			this.value = this.value.replace(/[^0-9]/g, '');
			
			// Update validation state
			var submitButton = document.getElementById('submit_imei_' + modem.id);
			if (this.value.length === 15) {
				this.style.borderColor = '';
				if (submitButton) submitButton.disabled = false;
			} else {
				this.style.borderColor = 'red';
				if (submitButton) submitButton.disabled = true;
			}
		});

		var hint = E('div', { 
			'class': 'cbi-value-description',
			'style': 'margin-top: 5px;'
		}, _('Enter exactly 15 digits'));
		
		newImeiField.appendChild(imeiInput);
		newImeiField.appendChild(hint);
		newImeiSection.appendChild(newImeiField);
		container.appendChild(newImeiSection);

		// Submit button section
		var buttonSection = E('div', { 'class': 'cbi-value' });
		buttonSection.appendChild(E('label', { 'class': 'cbi-value-title' }, ''));
		var buttonField = E('div', { 'class': 'cbi-value-field' });
		
		var submitButton = E('button', {
			'class': 'btn cbi-button-action',
			'id': 'submit_imei_' + modem.id,
			'disabled': true,
			'click': function() {
				var newImei = imeiInput.value.trim();
				
				if (newImei.length !== 15) {
					ui.addNotification(null, E('p', _('IMEI must be exactly 15 digits')), 'error');
					return;
				}

				if (!/^[0-9]{15}$/.test(newImei)) {
					ui.addNotification(null, E('p', _('IMEI must contain only numbers')), 'error');
					return;
				}

				// Confirm before setting
				if (!confirm(_('Are you sure you want to change the IMEI to %s? This requires modem reboot.').format(newImei))) {
					return;
				}

				submitButton.disabled = true;
				submitButton.textContent = _('Setting...');

				xmodem.setImei(modem.id, newImei).then(function(result) {
					if (result && result.result) {
						self.showActionResult(submitButton, true, _('IMEI set to %s. Reboot the modem to apply.').format(newImei));
						ui.addNotification(null, E('p', _('IMEI set successfully. Please reboot the modem for changes to take effect.')), 'success');
						// Refresh the IMEI display
						self.loadImei(modem, currentImeiValue, imeiInput, submitButton);
					} else {
						self.showActionResult(submitButton, false, _('Failed to set IMEI'));
						ui.addNotification(null, E('p', _('Failed to set IMEI')), 'error');
						submitButton.disabled = false;
						submitButton.textContent = _('Apply');
					}
				}).catch(function(e) {
					self.showActionResult(submitButton, false, _('Error: %s').format(e.message));
					ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
					submitButton.disabled = false;
					submitButton.textContent = _('Apply');
				});
			}
		}, _('Apply'));
		
		buttonField.appendChild(submitButton);
		
		// Add warning message
		var warningDiv = E('div', { 
			'class': 'alert-message warning',
			'style': 'margin-top: 10px;'
		}, [
			E('strong', {}, _('Warning: ')),
			_('Changing IMEI may be illegal in some countries. Use at your own risk.')
		]);
		buttonField.appendChild(warningDiv);
		
		buttonSection.appendChild(buttonField);
		container.appendChild(buttonSection);

		// Load current IMEI
		self.loadImei(modem, currentImeiValue, imeiInput, submitButton);

		return container;
	},

	loadImei: function(modem, currentImeiValue, imeiInput, submitButton) {
		xmodem.getImei(modem.id).then(function(result) {
			if (!result || !result.imei) {
				currentImeiValue.textContent = _('Error loading IMEI');
				return;
			}

			var imei = result.imei;
			currentImeiValue.textContent = imei || _('Not available');
			
			// Pre-fill input with current IMEI for easy editing
			if (imei && imei.length === 15) {
				imeiInput.value = imei;
				imeiInput.dispatchEvent(new Event('input'));
			}

		}).catch(function(e) {
			currentImeiValue.textContent = _('Error');
			ui.addNotification(null, E('p', _('Error loading IMEI: %s').format(e.message)), 'error');
		});
	},

	createNeighborCellTab: function(modem) {
		var self = this;
		var container = E('fieldset', { 'class': 'cbi-section' });
		container.appendChild(E('style', {}, [
			'.neighbor-cell-list { border-top: 1px solid var(--border-color-low, #e0e0e0); width: 100%; }',
			'.neighbor-cell-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; padding: 10px 0; border-bottom: 1px solid var(--border-color-low, #e0e0e0); box-sizing: border-box; }',
			'.neighbor-cell-row:hover { background-color: var(--background-color-medium, #f5f5f5); }',
			'.neighbor-cell-rat { min-width: 46px; }',
			'.neighbor-cell-info { min-width: 0; width: 100%; }',
			'.neighbor-cell-params { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; gap: 8px; width: 100%; }',
			'.neighbor-cell-param { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
			'.neighbor-cell-action { justify-self: end; }',
			'.neighbor-cell-action .btn { white-space: nowrap; padding-left: 12px; padding-right: 12px; }',
			'@media screen and (max-width: 520px) {',
			'.neighbor-cell-row { grid-template-columns: auto 1fr auto; gap: 8px; padding: 9px 0; }',
			'.neighbor-cell-params { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; font-size: 0.92em; }',
			'.neighbor-cell-action .btn { padding: 4px 8px; min-width: 0; }',
			'}'
		].join('\n')));
		var legend = E('legend', {}, _('Neighbor Cell / Lock Cell'));
		container.appendChild(legend);

		var description = E('div', { 'class': 'cbi-section-descr' }, 
			_('Scan neighboring cell towers and lock modem to specific cell. You can scan for nearby cells and then lock to a specific cell by copying its parameters.'));
		container.appendChild(description);

		// Create three sections: Neighbor Cell List, Lock Cell Status, Lock Cell Settings
		
		// 1. Neighbor Cell List Section
		var neighborSection = E('div', { 
			'class': 'cbi-section',
			'style': 'margin-bottom: 20px;'
		});
		var neighborHeader = E('h3', { 'style': 'margin: 10px 0;' }, _('Neighbor Cell List'));
		neighborSection.appendChild(neighborHeader);
		
		var scanButton = E('button', {
			'class': 'btn cbi-button-action',
			'id': 'scan_neighbor_' + modem.id,
			'style': 'margin-bottom: 10px;',
			'click': function() {
				scanButton.disabled = true;
				scanButton.textContent = _('Scanning...');
				dom.content(neighborList, E('div', { 'class': 'spinning' }, _('Scanning neighbor cells...')));
				
				self.scanNeighborCell(modem, neighborList, scanButton);
			}
		}, _('Scan Neighbor Cells'));
		neighborSection.appendChild(scanButton);
		
		var neighborList = E('div', { 
			'id': 'neighbor_list_' + modem.id,
			'style': 'margin-top: 10px;'
		});
		neighborList.appendChild(E('em', {}, _('Click "Scan Neighbor Cells" to search for nearby cell towers')));
		neighborSection.appendChild(neighborList);
		container.appendChild(neighborSection);

		// 2. Lock Cell Status Section
		var statusSection = E('div', { 
			'class': 'cbi-section',
			'style': 'margin-bottom: 20px;'
		});
		var statusHeader = E('h3', { 'style': 'margin: 10px 0;' }, _('Lock Cell Status'));
		statusSection.appendChild(statusHeader);
		
		var statusContent = E('div', { 
			'id': 'lockcell_status_' + modem.id,
			'class': 'cbi-value-field'
		});
		statusContent.appendChild(E('em', {}, _('No status information available')));
		statusSection.appendChild(statusContent);
		container.appendChild(statusSection);

		// 3. Lock Cell Settings Section
		var settingsSection = E('div', { 'class': 'cbi-section' });
		var settingsHeader = E('h3', { 'style': 'margin: 10px 0;' }, _('Lock Cell Settings'));
		settingsSection.appendChild(settingsHeader);

		var settingsDesc = E('div', { 
			'class': 'cbi-value-description',
			'style': 'margin-bottom: 15px;'
		}, _('Configure cell lock parameters. You can manually enter values or use the "Copy" button from scanned cells.'));
		settingsSection.appendChild(settingsDesc);

		// RAT Selection
		var ratSection = E('div', { 'class': 'cbi-value' });
		ratSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('RAT')));
		var ratField = E('div', { 'class': 'cbi-value-field' });
		var ratSelect = E('input', {
			'type': 'hidden',
			'id': 'rat_select_' + modem.id,
			'value': '0'
		});
		ratField.appendChild(E('span', { 'class': 'label', 'style': 'background-color: #2196F3; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;' }, 'LTE'));
		ratField.appendChild(ratSelect);
		ratSection.appendChild(ratField);
		settingsSection.appendChild(ratSection);

		// PCI Input
		var pciSection = E('div', { 'class': 'cbi-value' });
		pciSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('PCI')));
		var pciField = E('div', { 'class': 'cbi-value-field' });
		var pciInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'id': 'pci_input_' + modem.id,
			'placeholder': _('Physical Cell ID')
		});
		pciField.appendChild(pciInput);
		pciSection.appendChild(pciField);
		settingsSection.appendChild(pciSection);

		// ARFCN Input
		var arfcnSection = E('div', { 'class': 'cbi-value' });
		arfcnSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('ARFCN')));
		var arfcnField = E('div', { 'class': 'cbi-value-field' });
		var arfcnInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'id': 'arfcn_input_' + modem.id,
			'placeholder': _('Absolute Radio Frequency Channel Number')
		});
		arfcnField.appendChild(arfcnInput);
		arfcnSection.appendChild(arfcnField);
		settingsSection.appendChild(arfcnSection);

		var bandInput = { value: '' };
		var scsSelect = { value: '' };
		var bandRow = { style: { display: 'none' } };
		var scsRow = { style: { display: 'none' } };

		// Submit Button
		var buttonSection = E('div', { 'class': 'cbi-value' });
		buttonSection.appendChild(E('label', { 'class': 'cbi-value-title' }, ''));
		var buttonField = E('div', { 'class': 'cbi-value-field' });
		var unlockButton = E('button', {
			'class': 'btn cbi-button-action',
			'id': 'unlock_button_' + modem.id,
			'style': 'margin-right: 10px;',
			'click': function() {
				// Unlock cell
				var btn = this;
				btn.disabled = true;
				btn.textContent = _('Unlocking...');
				// rpc call lockcell but arfcn and pci empty
				xmodem.setNeighborCell(modem.id, {
					rat: '0',
					pci: '',
					arfcn: '',
					band: '',
					scs: ''
				}).then(function(result) {
					var rpcResult = result && result.result;
					if (rpcResult && rpcResult.status === '1') {
						self.showActionResult(btn, true, rpcResult.message || _('Cell unlocked. Modem is reconnecting.'));
						ui.addNotification(null, E('p', rpcResult.message || _('Cell unlocked. Modem is reconnecting.')), 'success');
						window.setTimeout(function() {
							self.updateLockCellStatus(modem, statusContent);
						}, 8000);
					} else {
						var message = (rpcResult && rpcResult.message) || _('Failed to unlock cell');
						self.showActionResult(btn, false, message);
						ui.addNotification(null, E('p', message), 'error');
					}
					btn.disabled = false;
					btn.textContent = _('Unlock Cell');
				}).catch(function(e) {
					self.showActionResult(btn, false, _('Error: %s').format(e.message));
					ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
					btn.disabled = false;
					btn.textContent = _('Unlock Cell');
				});
			}
		}, _('Unlock Cell'));
		buttonField.appendChild(unlockButton);
		var submitButton = E('button', {
			'class': 'btn cbi-button-action',
			'id': 'submit_lockcell_' + modem.id,
			'click': function() {
				var config = {
					rat: '0',
					pci: pciInput.value.trim(),
					arfcn: arfcnInput.value.trim(),
					band: '',
					scs: ''
				};

				if (!config.arfcn) {
					ui.addNotification(null, E('p', _('ARFCN is required. Leave PCI empty to lock frequency only.')), 'error');
					return;
				}

				submitButton.disabled = true;
				submitButton.textContent = _('Applying...');

				xmodem.setNeighborCell(modem.id, config).then(function(result) {
					var rpcResult = result && result.result;
					if (rpcResult && rpcResult.status === '1') {
						var message = rpcResult.message || _('Cell lock applied. Modem is reconnecting.');
						self.showActionResult(submitButton, true, message);
						ui.addNotification(null, E('p', message), 'success');
						window.setTimeout(function() {
							self.updateLockCellStatus(modem, statusContent);
						}, 8000);
					} else {
						var failMessage = (rpcResult && rpcResult.message) || _('Failed to apply lock cell configuration');
						self.showActionResult(submitButton, false, failMessage);
						ui.addNotification(null, E('p', failMessage), 'error');
					}
					submitButton.disabled = false;
					submitButton.textContent = _('Apply');
				}).catch(function(e) {
					self.showActionResult(submitButton, false, _('Error: %s').format(e.message));
					ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
					submitButton.disabled = false;
					submitButton.textContent = _('Apply');
				});
			}
		}, _('Apply'));
		buttonField.appendChild(submitButton);
		buttonSection.appendChild(buttonField);
		settingsSection.appendChild(buttonSection);

		container.appendChild(settingsSection);

		// Store references for copy functionality
		this.neighborCellInputs = this.neighborCellInputs || {};
		this.neighborCellInputs[modem.id] = {
			rat: ratSelect,
			pci: pciInput,
			arfcn: arfcnInput,
			band: bandInput,
			scs: scsSelect,
			bandRow: bandRow,
			scsRow: scsRow
		};

		statusContent.textContent = _('Loading lock cell status...');
		neighborList.classList.add('spinning');
		neighborList.textContent = _('Loading neighbor cell information...');
		scanButton.disabled = true;
		scanButton.textContent = _('Loading...');
		window.setTimeout(function() {
			self.scanNeighborCell(modem, neighborList, scanButton, true);
		}, 0);

		return container;
	},

	scanNeighborCell: function(modem, neighborList, scanButton, initialLoad) {
		var self = this;
		
		xmodem.getNeighborCell(modem.id).then(function(result) {
			if (!result) {
				neighborList.classList.remove('spinning');
				dom.content(neighborList, E('div', { 'class': 'alert-message warning' },
					_('No result returned from neighbor cell scan')));
				scanButton.disabled = false;
				scanButton.textContent = _('Scan Neighbor Cells');
				return;
			}
			result = result.neighborcell;
			var lteCells = result.LTE || [];
			var lockcellStatus = result.lockcell_status || {};

			// Update status section
			var statusContent = document.getElementById('lockcell_status_' + modem.id);
			if (statusContent) {
				self.updateLockCellStatus(modem, statusContent, lockcellStatus);
			}
			self.syncDetectedCellInputs(modem, lockcellStatus, lteCells, initialLoad);

			if (lteCells.length === 0) {
				neighborList.classList.remove('spinning');
				dom.content(neighborList, E('div', { 'class': 'alert-message info' },
					_('No LTE cells found. Make sure the modem has network signal.')));
				scanButton.disabled = false;
				scanButton.textContent = _('Scan Neighbor Cells');
				return;
			}

			var container = E('div', {});
			neighborList.classList.remove('spinning');

			var lteSection = E('div', { 'class': 'cbi-section' });
			var lteHeader = E('h4', { 'style': 'margin: 10px 0 5px 0;' }, _('LTE Cells'));
			lteSection.appendChild(lteHeader);
			var lteList = E('div', { 'class': 'neighbor-cell-list' });
			lteCells.forEach(function(cell) {
				var row = self.createNeighborCellRow(modem, cell);
				lteList.appendChild(row);
			});
			lteSection.appendChild(lteList);
			container.appendChild(lteSection);

			dom.content(neighborList, container);
			scanButton.disabled = false;
			scanButton.textContent = _('Scan Neighbor Cells');

		}).catch(function(e) {
			console.error('getNeighborCell error:', e);
			neighborList.classList.remove('spinning');
			dom.content(neighborList, E('div', { 'class': 'alert-message error' },
				_('Error scanning neighbor cells: %s').format(e.message || e.toString())));
			scanButton.disabled = false;
			scanButton.textContent = _('Scan Neighbor Cells');
		});
	},

	createNeighborCellRow: function(modem, cellInfo) {
		var self = this;
		
		var row = E('div', { 'class': 'neighbor-cell-row' });

		var ratCell = E('div', { 'class': 'neighbor-cell-rat' });
		var ratBadge = E('span', { 
			'class': 'label',
			'style': 'padding: 2px 8px; border-radius: 3px; font-weight: bold; background-color: #2196F3; color: white;'
		}, 'LTE');
		ratCell.appendChild(ratBadge);
		row.appendChild(ratCell);

		var infoCell = E('div', { 'class': 'neighbor-cell-info' });
		var infoParts = [];
		var orderedKeys = ['pci', 'arfcn', 'rsrp'];
		orderedKeys.forEach(function(key) {
			if (cellInfo[key] !== '' && cellInfo[key] !== null && cellInfo[key] !== undefined) {
				infoParts.push(E('span', { 'class': 'neighbor-cell-param' }, [
					E('strong', {}, key + ': '),
					E('span', { 'style': 'font-family: monospace;' }, cellInfo[key].toString())
				]));
			}
		});
		for (var key in cellInfo) {
			if (orderedKeys.indexOf(key) === -1 && cellInfo[key] !== '' && cellInfo[key] !== null && cellInfo[key] !== undefined) {
				infoParts.push(E('span', { 'class': 'neighbor-cell-param' }, [
					E('strong', {}, key + ': '),
					E('span', { 'style': 'font-family: monospace;' }, cellInfo[key].toString())
				]));
			}
		}
		var infoWrapper = E('div', { 'class': 'neighbor-cell-params' });
		infoParts.forEach(function(part) {
			infoWrapper.appendChild(part);
		});
		infoCell.appendChild(infoWrapper);
		row.appendChild(infoCell);

		var actionCell = E('div', { 'class': 'neighbor-cell-action' });
		var copyButton = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			'click': function() {
				if (!self.neighborCellInputs || !self.neighborCellInputs[modem.id]) {
					ui.addNotification(null, E('p', _('Configuration inputs not found')), 'error');
					return;
				}

				var inputs = self.neighborCellInputs[modem.id];
				inputs.rat.value = '0';
				inputs.pci.value = cellInfo.pci || '';
				inputs.arfcn.value = cellInfo.arfcn || '';
				inputs.band.value = '';
				inputs.bandRow.style.display = 'none';
				inputs.scsRow.style.display = 'none';

				ui.addNotification(null, E('p', _('Cell parameters copied to settings')), 'info');
			}
		}, _('Copy'));
		actionCell.appendChild(copyButton);
		row.appendChild(actionCell);

		return row;
	},

	syncLockCellInputs: function(modem, lockcellStatus) {
		if (!lockcellStatus || !this.neighborCellInputs || !this.neighborCellInputs[modem.id]) {
			return;
		}

		var status = (lockcellStatus.Status || '').toString().toLowerCase();
		var arfcn = lockcellStatus.ARFCN || lockcellStatus.arfcn || '';
		var pci = lockcellStatus.PCI || lockcellStatus.pci || '';

		if (status !== 'lock' || !arfcn || arfcn === '0') {
			return;
		}

		var inputs = this.neighborCellInputs[modem.id];
		inputs.rat.value = '0';
		inputs.arfcn.value = arfcn;
		inputs.pci.value = pci || '';
		inputs.band.value = '';
		inputs.bandRow.style.display = 'none';
		inputs.scsRow.style.display = 'none';
	},

	syncDetectedCellInputs: function(modem, lockcellStatus, lteCells, initialLoad) {
		if (!initialLoad || !this.neighborCellInputs || !this.neighborCellInputs[modem.id]) {
			return;
		}

		var status = lockcellStatus && (lockcellStatus.Status || '').toString().toLowerCase();
		if (status === 'lock') {
			return;
		}

		var inputs = this.neighborCellInputs[modem.id];
		var cell = lteCells && lteCells[0];

		inputs.rat.value = '0';
		inputs.pci.value = cell && cell.pci ? cell.pci : '';
		inputs.arfcn.value = cell && cell.arfcn ? cell.arfcn : '';
		inputs.band.value = '';
		inputs.bandRow.style.display = 'none';
		inputs.scsRow.style.display = 'none';
	},

	updateLockCellStatus: function(modem, statusContent, lockcellStatus) {
		if (!lockcellStatus) {
			// Try to get fresh status
			xmodem.getNeighborCell(modem.id).then(function(result) {
				result = result.neighborcell;
				if (result && result.lockcell_status) {
					self.syncLockCellInputs(modem, result.lockcell_status);
					renderStatus(result.lockcell_status);
				} else {
					dom.content(statusContent, E('em', {}, _('No status information available')));
				}
			}).catch(function(e) {
				dom.content(statusContent, E('em', {}, _('Error loading status')));
			});
			return;
		}

		function renderStatus(status) {
			var statusItems = [];
			for (var key in status) {
				if (status[key] !== '' && status[key] !== null && status[key] !== undefined) {
					statusItems.push(key + ': ' + status[key].toString().toUpperCase());
				}
			}

			if (statusItems.length === 0) {
				dom.content(statusContent, E('em', {}, _('Cell is unlocked (no lock active)')));
			} else {
				var statusDiv = E('div', {});
				statusItems.forEach(function(item) {
					statusDiv.appendChild(E('div', { 
						'style': 'padding: 3px 0;'
					}, item));
				});
				dom.content(statusContent, statusDiv);
			}
		}

		this.syncLockCellInputs(modem, lockcellStatus);
		renderStatus(lockcellStatus);
	},

	createLockBandTab: function(modem) {
		var self = this;
		var container = E('fieldset', { 'class': 'cbi-section' });
		var legend = E('legend', {}, _('Lock Band Configuration'));
		container.appendChild(legend);

		var description = E('div', { 'class': 'cbi-section-descr' }, 
			_('Lock modem to specific frequency bands. Select bands for each network type (UMTS/LTE/NR).'));
		container.appendChild(description);

		// Lock band content area
		var lockbandContent = E('div', { 'id': 'lockband_content_' + modem.id });
		lockbandContent.appendChild(E('div', { 'class': 'spinning' }, _('Loading band configuration...')));
		container.appendChild(lockbandContent);

		// Load lockband configuration
		self.loadLockBand(modem, lockbandContent);

		return container;
	},

	loadLockBand: function(modem, lockbandContent) {
		var self = this;
		
		xmodem.getLockBand(modem.id).then(function(result) {
			
			if (!result) {
				dom.content(lockbandContent, E('div', { 'class': 'alert-message warning' },
					_('No result returned from getLockBand')));
				return;
			}

			// Handle different response structures
			var lockband = result.lockband || result;
			
			// Check if lockband is valid
			if (!lockband || typeof lockband !== 'object') {
				dom.content(lockbandContent, E('div', { 'class': 'alert-message warning' },
					_('Invalid lockband data structure')));
				return;
			}

			var bandClasses = Object.keys(lockband);

			// Filter out non-band-class keys
			bandClasses = bandClasses.filter(function(key) {
				return lockband[key] && typeof lockband[key] === 'object' &&
					   (lockband[key].available_band || lockband[key].lock_band);
			});

			if (bandClasses.length === 0) {
				dom.content(lockbandContent, E('div', { 'class': 'alert-message info' },
					_('No bands available for this modem')));
				return;
			}

			var container = E('div', {});

			// Store lockband state
			var lockbandState = {};

			bandClasses.forEach(function(bandClass) {
				var bandData = lockband[bandClass];
				
				// Ensure bandData has the expected structure
				if (!bandData || typeof bandData !== 'object') {
					console.warn('Invalid bandData for', bandClass, bandData);
					return;
				}
				
				// Get available_band (might be array or needs conversion)
				var availableBands = bandData.available_band || [];
				if (!Array.isArray(availableBands)) {
					console.warn('available_band is not an array for', bandClass);
					return;
				}
				
				if (availableBands.length === 0) {
					console.info('No available bands for', bandClass);
					return;
				}

				// Get locked bands (might be array or string)
				var lockedBands = bandData.lock_band || [];
				if (typeof lockedBands === 'string') {
					lockedBands = lockedBands.split(',').filter(function(b) { return b.length > 0; });
				}
				if (!Array.isArray(lockedBands)) {
					lockedBands = [];
				}

				// Initialize state for this band class
				lockbandState[bandClass] = {
					available: availableBands,
					locked: lockedBands
				};

				// Create section for this band class
				var bandSection = E('div', { 
					'class': 'cbi-section',
					'style': 'margin-bottom: 20px;'
				});

				var bandHeader = E('h3', { 
					'style': 'margin: 10px 0;'
				}, bandClass);
				bandSection.appendChild(bandHeader);

				// Current locked bands display
				var currentSection = E('div', { 
					'class': 'cbi-value',
					'style': 'margin-bottom: 10px;'
				});
				currentSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Locked Bands')));
				var currentField = E('div', { 'class': 'cbi-value-field' });
				var lockedDisplay = E('strong', { 
					'id': 'locked_' + modem.id + '_' + bandClass 
				});
				self.updateLockedDisplay(lockedDisplay, lockbandState[bandClass].locked, lockbandState[bandClass].available);
				currentField.appendChild(lockedDisplay);
				currentSection.appendChild(currentField);
				bandSection.appendChild(currentSection);

				// Band selection area
				var selectionSection = E('div', { 'class': 'cbi-value' });
				selectionSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Select Bands')));
				var selectionField = E('div', { 
					'class': 'cbi-value-field',
					'style': 'display: flex; flex-wrap: wrap;'
				});

				// Create checkboxes for each available band
				bandData.available_band.forEach(function(band) {
					var bandWrapper = E('div', { 
						'class': 'band-container',
						'style': 'display: flex; align-items: center; margin: 5px 15px 5px 0; min-width: 100px;'
					});

					var checkbox = E('input', {
						'type': 'checkbox',
						'name': 'band_' + modem.id + '_' + bandClass,
						'value': band.band_id,
						'id': 'band_' + modem.id + '_' + bandClass + '_' + band.band_id,
						'checked': lockbandState[bandClass].locked.includes(band.band_id.toString()) ? 'checked' : null,
						'change': function() {
							if (this.checked) {
								if (!lockbandState[bandClass].locked.includes(band.band_id.toString())) {
									lockbandState[bandClass].locked.push(band.band_id.toString());
								}
							} else {
								lockbandState[bandClass].locked = lockbandState[bandClass].locked.filter(function(b) {
									return b !== band.band_id.toString();
								});
							}
							self.updateLockedDisplay(lockedDisplay, lockbandState[bandClass].locked, bandData.available_band);
						}
					});

					var label = E('label', {
						'for': 'band_' + modem.id + '_' + bandClass + '_' + band.band_id,
						'style': 'margin-left: 5px; cursor: pointer;'
					}, band.band_name);

					bandWrapper.appendChild(checkbox);
					bandWrapper.appendChild(label);
					selectionField.appendChild(bandWrapper);
				});

				selectionSection.appendChild(selectionField);
				bandSection.appendChild(selectionSection);

				// Action buttons for this band class
				var buttonSection = E('div', { 
					'class': 'cbi-value',
					'style': 'margin-top: 10px;'
				});
				buttonSection.appendChild(E('label', { 'class': 'cbi-value-title' }, ''));
				var buttonField = E('div', { 'class': 'cbi-value-field' });

				// Select All button
				var selectAllBtn = E('button', {
					'class': 'btn cbi-button',
					'style': 'margin-right: 10px;',
					'click': function() {
						var allSelected = lockbandState[bandClass].locked.length === bandData.available_band.length;
						
						if (allSelected) {
							// Unselect all
							lockbandState[bandClass].locked = [];
							selectionField.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
								cb.checked = false;
							});
						} else {
							// Select all
							lockbandState[bandClass].locked = bandData.available_band.map(function(b) {
								return b.band_id.toString();
							});
							selectionField.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
								cb.checked = true;
							});
						}
						self.updateLockedDisplay(lockedDisplay, lockbandState[bandClass].locked, bandData.available_band);
					}
				}, _('Select All / None'));

				// Apply button
				var applyBtn = E('button', {
					'class': 'btn cbi-button-action',
					'click': function() {
						var params = {
							band_class: bandClass,
							lock_band: lockbandState[bandClass].locked.sort(function(a, b) {
								return parseInt(a) - parseInt(b);
							}).join(',')
						};

						applyBtn.disabled = true;
						applyBtn.textContent = _('Applying...');

						xmodem.setLockBand(modem.id, params).then(function(result) {
							if (result && result.result) {
								self.showActionResult(applyBtn, true, _('%s locked to: %s').format(bandClass, params.lock_band || _('all bands')));
								ui.addNotification(null, E('p', _('Lock band configuration applied for %s').format(bandClass)), 'success');
								// Refresh the display
								self.loadLockBand(modem, lockbandContent);
							} else {
								self.showActionResult(applyBtn, false, _('Failed to apply lock band configuration'));
								ui.addNotification(null, E('p', _('Failed to apply lock band configuration')), 'error');
								applyBtn.disabled = false;
								applyBtn.textContent = _('Apply');
							}
						}).catch(function(e) {
							self.showActionResult(applyBtn, false, _('Error: %s').format(e.message));
							ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
							applyBtn.disabled = false;
							applyBtn.textContent = _('Apply');
						});
					}
				}, _('Apply'));

				buttonField.appendChild(selectAllBtn);
				buttonField.appendChild(applyBtn);
				buttonSection.appendChild(buttonField);
				bandSection.appendChild(buttonSection);

				container.appendChild(bandSection);
			});

			dom.content(lockbandContent, container);

		}).catch(function(e) {
			console.error('getLockBand error:', e);
			dom.content(lockbandContent, E('div', { 'class': 'alert-message error' }, [
				E('p', {}, _('Error loading lock band configuration:')),
				E('p', {}, e.message || e.toString()),
				E('p', { 'style': 'font-size: 0.9em; margin-top: 10px;' }, 
					_('Please check browser console for more details'))
			]));
		});
	},

	updateLockedDisplay: function(displayElement, lockedBands, availableBands) {
		if (lockedBands.length === 0) {
			displayElement.textContent = _('None (All bands unlocked)');
			displayElement.style.color = '';
			return;
		}

		// Create display with band names
		var bandNames = [];
		lockedBands.forEach(function(bandId) {
			var band = availableBands.find(function(b) {
				return b.band_id.toString() === bandId.toString();
			});
			if (band) {
				bandNames.push(band.band_name);
			} else {
				bandNames.push(bandId);
			}
		});

		displayElement.textContent = bandNames.join(', ');
		displayElement.style.color = '#0066cc';
	},

	createRebootModemTab: function(modem) {
		var self = this;
		var container = E('fieldset', { 'class': 'cbi-section' });
		var legend = E('legend', {}, _('Reboot Modem'));
		container.appendChild(legend);

		var description = E('div', { 'class': 'cbi-section-descr' }, 
			_('Reboot the modem device. Soft reboot restarts the modem firmware, hard reboot power cycles the modem.'));
		container.appendChild(description);

		// Reboot buttons section
		var rebootSection = E('div', { 'class': 'cbi-value' });
		rebootSection.appendChild(E('label', { 'class': 'cbi-value-title' }, _('Reboot Options')));
		var rebootField = E('div', { 
			'class': 'cbi-value-field',
			'id': 'reboot_buttons_' + modem.id
		});
		rebootField.appendChild(E('div', { 'class': 'spinning' }, _('Loading reboot capabilities...')));
		rebootSection.appendChild(rebootField);
		container.appendChild(rebootSection);

		// Load reboot capabilities and create buttons
		self.loadRebootCaps(modem, rebootField);

		return container;
	},

	loadRebootCaps: function(modem, rebootField) {
		var self = this;
		
		xmodem.getRebootCaps(modem.id).then(function(result) {
			if (!result || !result.reboot_caps) {
				dom.content(rebootField, E('em', {}, _('Failed to load reboot capabilities')));
				return;
			}

			var caps = result.reboot_caps;
			var hasSoftReboot = caps.soft_reboot_caps === '1' || caps.soft_reboot_caps === 1;
			var hasHardReboot = caps.hard_reboot_caps === '1' || caps.hard_reboot_caps === 1;

			if (!hasSoftReboot && !hasHardReboot) {
				dom.content(rebootField, E('em', {}, _('No reboot methods available for this modem')));
				return;
			}

			var buttonContainer = E('div', {});

			// Soft Reboot Button
			if (hasSoftReboot) {
				var softRebootBtn = E('button', {
					'class': 'btn cbi-button-action',
					'id': 'soft_reboot_' + modem.id,
					'style': 'margin-right: 10px; margin-bottom: 10px;',
					'click': function() {
						if (!confirm(_('Are you sure you want to perform a soft reboot? The modem will restart and may lose connection temporarily.'))) {
							return;
						}

						softRebootBtn.disabled = true;
						softRebootBtn.textContent = _('Rebooting...');

						xmodem.doReboot(modem.id, 'soft').then(function(result) {
							if (result && result.result && result.result.status === '1') {
								self.showActionResult(softRebootBtn, true, _('Soft reboot initiated (AT+CFUN=1,1). The modem is restarting and will reconnect automatically.'));
								ui.addNotification(null, E('p', _('Soft reboot initiated successfully. The modem is restarting...')), 'success');
								setTimeout(function() {
									softRebootBtn.disabled = false;
									softRebootBtn.textContent = _('Soft Reboot');
								}, 10000);
							} else {
								self.showActionResult(softRebootBtn, false, _('Failed to initiate soft reboot'));
								ui.addNotification(null, E('p', _('Failed to initiate soft reboot')), 'error');
								softRebootBtn.disabled = false;
								softRebootBtn.textContent = _('Soft Reboot');
							}
						}).catch(function(e) {
							self.showActionResult(softRebootBtn, false, _('Error: %s').format(e.message));
							ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
							softRebootBtn.disabled = false;
							softRebootBtn.textContent = _('Soft Reboot');
						});
					}
				}, _('Soft Reboot'));
				
				buttonContainer.appendChild(softRebootBtn);
			}

			// Hard Reboot Button
			if (hasHardReboot) {
				var hardRebootBtn = E('button', {
					'class': 'btn cbi-button-negative',
					'id': 'hard_reboot_' + modem.id,
					'style': 'margin-bottom: 10px;',
					'click': function() {
						if (!confirm(_('Are you sure you want to perform a hard reboot? This will power cycle the modem and may cause a longer disconnection.'))) {
							return;
						}

						hardRebootBtn.disabled = true;
						hardRebootBtn.textContent = _('Rebooting...');

						xmodem.doReboot(modem.id, 'hard').then(function(result) {
							if (result && result.result && result.result.status === '1') {
								self.showActionResult(hardRebootBtn, true, _('Hard reboot initiated. The modem is power cycling and will reconnect automatically.'));
								ui.addNotification(null, E('p', _('Hard reboot initiated successfully. The modem is restarting...')), 'success');
								setTimeout(function() {
									hardRebootBtn.disabled = false;
									hardRebootBtn.textContent = _('Hard Reboot');
								}, 15000);
							} else {
								self.showActionResult(hardRebootBtn, false, _('Failed to initiate hard reboot'));
								ui.addNotification(null, E('p', _('Failed to initiate hard reboot')), 'error');
								hardRebootBtn.disabled = false;
								hardRebootBtn.textContent = _('Hard Reboot');
							}
						}).catch(function(e) {
							self.showActionResult(hardRebootBtn, false, _('Error: %s').format(e.message));
							ui.addNotification(null, E('p', _('Error: %s').format(e.message)), 'error');
							hardRebootBtn.disabled = false;
							hardRebootBtn.textContent = _('Hard Reboot');
						});
					}
				}, _('Hard Reboot'));
				
				buttonContainer.appendChild(hardRebootBtn);
			}

			// Add descriptions
			var descContainer = E('div', { 'style': 'margin-top: 15px;' });
			
			if (hasSoftReboot) {
				descContainer.appendChild(E('div', { 'style': 'margin-bottom: 5px;' }, [
					E('strong', {}, _('Soft Reboot') + ': '),
					E('span', {}, _('Restarts the modem firmware without power cycling. Faster but may not resolve all issues.'))
				]));
			}
			
			if (hasHardReboot) {
				descContainer.appendChild(E('div', { 'style': 'margin-bottom: 5px;' }, [
					E('strong', {}, _('Hard Reboot') + ': '),
					E('span', {}, _('Power cycles the modem completely. Takes longer but ensures a full restart.'))
				]));
			}

			buttonContainer.appendChild(descContainer);
			dom.content(rebootField, buttonContainer);

		}).catch(function(e) {
			dom.content(rebootField, E('div', { 'class': 'alert-message error' },
				_('Error loading reboot capabilities: %s').format(e.message)));
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
