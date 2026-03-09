frappe.provide("frappe.ui.form");

frappe.ui.form._strip_seconds_from_time_format =
	frappe.ui.form._strip_seconds_from_time_format ||
	function (time_format) {
		if (!time_format) return "HH:mm";
		let out = String(time_format);
		out = out.replace(/:s{1,2}/gi, "");
		out = out.replace(/\s{2,}/g, " ").trim();
		return out || "HH:mm";
	};

frappe.ui.form._get_time_format_no_seconds =
	frappe.ui.form._get_time_format_no_seconds ||
	function () {
		let sysdefaults = frappe.boot && frappe.boot.sysdefaults;
		let time_format =
			sysdefaults && sysdefaults.time_format ? sysdefaults.time_format : "HH:mm:ss";
		return frappe.ui.form._strip_seconds_from_time_format(time_format);
	};

frappe.ui.form._ensure_timepicker_tick_styles =
	frappe.ui.form._ensure_timepicker_tick_styles ||
	function () {
		const id = "frappe-timepicker-ticks-css";
		let css = document.getElementById(id);
		const content = `
			.datepicker--time-row.frappe-time-row-hours {
				position: relative;
				margin-bottom: 14px;
			}

			/* Hour ticks: every 3 hours across the slider track */
			.datepicker--time-row.frappe-time-row-hours input[type="range"] {
				position: relative;
				background-color: transparent;
			}

			.datepicker--time-row.frappe-time-row-hours input[type="range"]::-webkit-slider-runnable-track {
				background-image: repeating-linear-gradient(
					to right,
					var(--gray-500, #a3aab2) 0,
					var(--gray-500, #a3aab2) 1px,
					transparent 1px,
					transparent 12.5%
				);
				background-repeat: no-repeat;
				background-position: center;
				background-size: 100% 8px;
			}

			.datepicker--time-row.frappe-time-row-hours input[type="range"]::-moz-range-track {
				background-image: repeating-linear-gradient(
					to right,
					var(--gray-500, #a3aab2) 0,
					var(--gray-500, #a3aab2) 1px,
					transparent 1px,
					transparent 12.5%
				);
				background-repeat: no-repeat;
				background-position: center;
				background-size: 100% 8px;
			}

			.datepicker--time-row.frappe-time-row-hours input[type="range"]::-ms-track {
				background-image: repeating-linear-gradient(
					to right,
					var(--gray-500, #a3aab2) 0,
					var(--gray-500, #a3aab2) 1px,
					transparent 1px,
					transparent 12.5%
				);
				background-repeat: no-repeat;
				background-position: center;
				background-size: 100% 8px;
			}

			.datepicker--time-row.frappe-time-row-hours .frappe-time-labels {
				position: absolute;
				left: 0;
				right: 0;
				top: 100%;
				height: 12px;
				pointer-events: none;
			}

			.datepicker--time-row.frappe-time-row-hours .frappe-time-label {
				position: absolute;
				top: 0;
				transform: translateX(-50%);
				font-size: 10px;
				line-height: 12px;
				color: var(--text-muted, #6c7680);
				white-space: nowrap;
			}
		`;
		if (css) {
			css.textContent = content;
			return;
		}
		css = document.createElement("style");
		css.id = id;
		css.textContent = content;
		document.head.appendChild(css);
	};

frappe.ui.form._ensure_timepicker_hour_ticks =
	frappe.ui.form._ensure_timepicker_hour_ticks ||
	function (datepicker) {
		try {
			if (!datepicker || !datepicker.timepicker) return;
			const $tp = datepicker.timepicker;
			const $hours = $tp.$hours;
			if (!$hours || !$hours.length) return;
			const $row = $hours.closest(".datepicker--time-row");
			if (!$row || !$row.length) return;

			$row.find(".frappe-time-ticks").remove();
			$row.data("frappeHourTicks", true);

			frappe.ui.form._ensure_timepicker_tick_styles();
			$row.addClass("frappe-time-row-hours");

			const min = parseFloat($hours.attr("min") || "0");
			const max = parseFloat($hours.attr("max") || "24");
			const range = max - min;
			if (!isFinite(range) || range <= 0) return;

			const step = 3;
			let start = Math.ceil(min / step) * step;
			if (!isFinite(start)) start = min;

			let $labels = $row.find(".frappe-time-labels");
			if (!$labels.length) {
				$labels = $('<div class="frappe-time-labels" aria-hidden="true"></div>');
				$row.append($labels);
			}
			$labels.empty();

			const label_items = [];
			for (let h = start; h <= max; h += step) {
				const $label = $(`<span class="frappe-time-label">${h}</span>`);
				$labels.append($label);
				label_items.push({ value: h, el: $label.get(0) });
			}

			const position_labels = () => {
				try {
					const row_el = $row.get(0);
					const input_el = $hours.get(0);
					if (!row_el || !input_el) return;
					const row_rect = row_el.getBoundingClientRect();
					const input_rect = input_el.getBoundingClientRect();
					const left = input_rect.left - row_rect.left;
					const width = input_rect.width;
					if (!width) return;
					const thumb = 12;
					const usable = Math.max(0, width - thumb);
					label_items.forEach(({ value, el }) => {
						const pct = (value - min) / range;
						const x = left + thumb / 2 + usable * pct;
						el.style.left = `${x}px`;
					});
				} catch (_) {}
			};

			setTimeout(position_labels, 0);
		} catch (_) {}
	};

frappe.ui.form.ControlDatetime = class ControlDatetime extends frappe.ui.form.ControlDate {
	set_formatted_input(value) {
		if (this.timepicker_only) return;
		if (!this.datepicker) return;
		if (!value) {
			this.datepicker.clear();
			return;
		} else if (value.toLowerCase() === "today") {
			value = this.get_now_date();
		} else if (value.toLowerCase() === "now") {
			value = frappe.datetime.now_datetime();
		}
		let should_refresh = this.last_value && this.last_value !== value;
		value = this.format_for_input(value);
		this.$input && this.$input.val(value);
		if (should_refresh) {
			this.datepicker.selectDate(frappe.datetime.user_to_obj(value));
		}
	}

	get_start_date() {
		this.value = this.value == null || this.value == "" ? undefined : this.value;
		let value = frappe.datetime.convert_to_user_tz(this.value);
		return frappe.datetime.str_to_obj(value);
	}
	set_date_options() {
		super.set_date_options();
		this.today_text = __("Now");
		let sysdefaults = frappe.boot.sysdefaults;
		this.date_format = frappe.defaultDatetimeFormat;
		let time_format =
			sysdefaults && sysdefaults.time_format ? sysdefaults.time_format : "HH:mm:ss";
		time_format = frappe.ui.form._strip_seconds_from_time_format(time_format);
		$.extend(this.datepicker_options, {
			timepicker: true,
			timeFormat: time_format.toLowerCase().replace("mm", "ii"),
		});
	}
	get_now_date() {
		return frappe.datetime.now_datetime(true);
	}
	parse(value) {
		if (value) {
			value = frappe.datetime.user_to_str(value, false);

			if (!frappe.datetime.is_system_time_zone()) {
				value = frappe.datetime.convert_to_system_tz(value, true);
			}

			if (value == "Invalid date") {
				value = "";
			}
		}
		return value;
	}
	format_for_input(value) {
		if (!value) return "";
		return frappe.datetime.str_to_user(value, false);
	}
	set_description() {
		const description = this.df.description;
		const time_zone = this.get_user_time_zone();

		if (!this.df.hide_timezone) {
			// Always show the timezone when rendering the Datetime field since the datetime value will
			// always be in system_time_zone rather then local time.

			if (!description) {
				this.df.description = time_zone;
			} else if (!description.includes(time_zone)) {
				this.df.description += "<br>" + time_zone;
			}
		}
		super.set_description();
	}
	get_user_time_zone() {
		return frappe.boot.time_zone ? frappe.boot.time_zone.user : frappe.sys_defaults.time_zone;
	}
	set_datepicker() {
		super.set_datepicker();
		if (this.datepicker.opts.timeFormat.indexOf("s") == -1) {
			// No seconds in time format
			const $tp = this.datepicker.timepicker;
			$tp.$seconds.parent().css("display", "none");
			$tp.$secondsText.css("display", "none");
			$tp.$secondsText.prev().css("display", "none");
		}
		frappe.ui.form._ensure_timepicker_hour_ticks(this.datepicker);
	}

	get_model_value() {
		let value = super.get_model_value();
		if (!value && !this.doc) {
			value = this.last_value;
		}
		return !value ? "" : frappe.datetime.get_datetime_as_string(value);
	}
};
