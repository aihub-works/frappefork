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

frappe.ui.form.ControlTime = class ControlTime extends frappe.ui.form.ControlDate {
	set_formatted_input(value) {
		super.set_formatted_input(value);
	}
	make_input() {
		this.timepicker_only = true;
		super.make_input();
	}
	make_picker() {
		this.set_time_options();
		this.set_datepicker();
		this.refresh();
	}
	set_time_options() {
		let sysdefaults = frappe.boot.sysdefaults;

		let time_format =
			sysdefaults && sysdefaults.time_format ? sysdefaults.time_format : "HH:mm:ss";
		time_format = frappe.ui.form._strip_seconds_from_time_format(time_format);

		this.time_format = frappe.defaultTimeFormat;
		this.time_format_no_seconds = time_format;
		this.datepicker_options = {
			language: "en",
			timepicker: true,
			onlyTimepicker: true,
			timeFormat: time_format.toLowerCase().replace("mm", "ii"),
			startDate: frappe.datetime.now_time(true),
			onSelect: () => {
				// ignore micro seconds
				if (
					moment(this.get_value(), time_format).format("HH:mm:ss") !=
					moment(this.value, time_format).format("HH:mm:ss")
				) {
					this.$input.trigger("change");
				}
			},
			onShow: () => {
				$(".datepicker--button:visible").text(__("Now"));

				this.update_datepicker_position();
			},
			keyboardNav: false,
			todayButton: true,
		};
	}
	set_input(value) {
		super.set_input(value);
		if (!this.datepicker) {
			return;
		}
		if (
			value &&
			((this.last_value && this.last_value !== this.value) ||
				!this.datepicker.selectedDates.length)
		) {
			let time_format =
				(frappe.sys_defaults && frappe.sys_defaults.time_format) || "HH:mm:ss";
			time_format = frappe.ui.form._strip_seconds_from_time_format(time_format);
			var date_obj = frappe.datetime.moment_to_date_obj(moment(value, time_format));
			this.datepicker.selectDate(date_obj);
		}
	}
	set_datepicker() {
		this.$input.datepicker(this.datepicker_options);
		this.datepicker = this.$input.data("datepicker");

		this.datepicker.$datepicker.find('[data-action="today"]').click(() => {
			this.datepicker.selectDate(frappe.datetime.now_time(true));
			this.datepicker.hide();
		});
		if (this.datepicker.opts.timeFormat.indexOf("s") == -1) {
			// No seconds in time format
			const $tp = this.datepicker.timepicker;
			$tp.$seconds.parent().css("display", "none");
			$tp.$secondsText.css("display", "none");
			$tp.$secondsText.prev().css("display", "none");
		}
		frappe.ui.form._ensure_timepicker_hour_ticks(this.datepicker);
	}
	set_description() {
		const { description } = this.df;
		const { time_zone } = frappe.sys_defaults;
		if (!frappe.datetime.is_system_time_zone()) {
			if (!description) {
				this.df.description = time_zone;
			} else if (!description.includes(time_zone)) {
				this.df.description += "<br>" + time_zone;
			}
		}
		super.set_description();
	}
	parse(value) {
		if (value) {
			if (value == "Invalid date") {
				value = "";
			}
			return frappe.datetime.user_to_str(value, true);
		}
	}
	format_for_input(value) {
		if (value) {
			return frappe.datetime.str_to_user(value, true);
		}
		return "";
	}
	validate(value) {
		if (value && !frappe.datetime.validate(value)) {
			let sysdefaults = frappe.sys_defaults;
			let time_format =
				sysdefaults && sysdefaults.time_format ? sysdefaults.time_format : "HH:mm:ss";
			time_format = frappe.ui.form._strip_seconds_from_time_format(time_format);
			frappe.msgprint(__("Time {0} must be in format: {1}", [value, time_format]));
			return "";
		}
		return value;
	}
};
