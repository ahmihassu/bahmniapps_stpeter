'use strict';

Bahmni.Clinical.O2Session = (function () {

    var O2Session = function (data) {
        this.patientUuid = data.patientUuid;
        this.wardUuid = data.wardUuid;
        this.sessionUuid = data.sessionUuid || null;
        this.startTime = data.startTime || new Date();
        this.endTime = data.endTime || null;
        this.status = data.status || Bahmni.Clinical.O2Session.STATUS.ACTIVE;
        this.segments = data.segments || [];
        this.lastBilledAt = data.lastBilledAt || null;
    };

    // ── Static factories ──────────────────────────────────────────────────────
    O2Session.create = function (patientUuid, wardUuid, initialFlowRate, startTime) {
        var start = startTime || new Date();
        var session = new O2Session({
            patientUuid: patientUuid,
            wardUuid: wardUuid,
            startTime: start,
            status: Bahmni.Clinical.O2Session.STATUS.ACTIVE,
            segments: [],
            lastBilledAt: start
        });
        session._openSegment(initialFlowRate, start);
        return session;
    };

    /**
     * Rebuild a session from an array of saved observation groups.
     * Each group comes from one saved instance of the St. Peter form.
     * Groups must be sorted by startTime ascending before calling this.
     *
     * @param {string} patientUuid
     * @param {string} wardUuid
     * @param {Array} groups - [{ flowRate, startTime, endTime, patientOffO2 }]
     * @param {Date} lastBilledAt
     * @returns {O2Session}
     */
    O2Session.fromSavedGroups = function (patientUuid, wardUuid, groups, lastBilledAt) {
        if (!groups || groups.length === 0) { return null; }

        var isDiscontinued = _.some(groups, function (g) { return g.patientOffO2 === true; });
        var segments = [];

        groups.forEach(function (group, index) {
            var nextGroup = groups[index + 1];
            // End time = next segment's start time, or null if this is the last one
            var endTime = nextGroup ? nextGroup.startTime : null;
            // If patient is off O2 and this is the last group, use its endTime if set
            if (!nextGroup && isDiscontinued && group.endTime) {
                endTime = group.endTime;
            }
            segments.push({
                flowRate: group.flowRate,
                startTime: group.startTime,
                endTime: endTime
            });
        });

        var session = new O2Session({
            patientUuid: patientUuid,
            wardUuid: wardUuid,
            startTime: segments[0].startTime,
            endTime: isDiscontinued ? segments[segments.length - 1].endTime : null,
            status: isDiscontinued
                ? Bahmni.Clinical.O2Session.STATUS.DISCONTINUED
                : Bahmni.Clinical.O2Session.STATUS.ACTIVE,
            segments: segments,
            lastBilledAt: lastBilledAt || segments[0].startTime
        });
        return session;
    };

    // ── Instance methods ──────────────────────────────────────────────────────

    O2Session.prototype = {

        _openSegment: function (flowRate, startTime) {
            var segment = {
                flowRate: flowRate,
                startTime: startTime || new Date(),
                endTime: null
            };
            this.segments.push(segment);
        },

        changeFlowRate: function (newFlowRate) {
            var now = new Date();
            var openSegment = this._getOpenSegment();
            if (!openSegment) {
                this._openSegment(newFlowRate, now);
                return;
            }
            openSegment.endTime = now;
            this._openSegment(newFlowRate, now);
        },

        _getOpenSegment: function () {
            return _.find(this.segments, function (s) { return s.endTime === null; }) || null;
        },

        // Tasks 5, 6, 7: Calculate total liters between two timestamps
        calculateConsumption: function (fromTime, toTime) {
            var now = toTime || new Date();
            var totalLiters = 0;

            this.segments.forEach(function (segment) {
                var segEnd = segment.endTime || now;
                var windowStart = segment.startTime > fromTime ? segment.startTime : fromTime;
                var windowEnd = segEnd < now ? segEnd : now;

                if (windowEnd <= windowStart) { return; }

                var durationMinutes = (windowEnd - windowStart) / 60000;
                totalLiters += segment.flowRate * durationMinutes;
            });
            return totalLiters;
        },

        // Returns duration of a segment in { hours, minutes } format for display
        getSegmentDuration: function (segmentIndex, referenceTime) {
            var segment = this.segments[segmentIndex];
            if (!segment) { return { hours: 0, minutes: 0 }; }
            var now = referenceTime || new Date();
            var endTime = segment.endTime || now;
            var totalMinutes = Math.floor((endTime - segment.startTime) / 60000);
            return {
                hours: Math.floor(totalMinutes / 60),
                minutes: totalMinutes % 60
            };
        },

        discontinue: function () {
            var now = new Date();
            var openSegment = this._getOpenSegment();
            if (openSegment) {
                openSegment.endTime = now;
            }
            this.endTime = now;
            this.status = Bahmni.Clinical.O2Session.STATUS.DISCONTINUED;
        },

        toJSON: function () {
            var payload = {
                patientUuid: this.patientUuid,
                wardUuid: this.wardUuid,
                sessionUuid: this.sessionUuid,
                startTime: this.startTime,
                endTime: this.endTime,
                status: this.status,
                segments: this.segments,
                lastBilledAt: this.lastBilledAt
            };
            return payload;
        }
    };

    O2Session.STATUS = {
        ACTIVE: 'ACTIVE',
        DISCONTINUED: 'DISCONTINUED',
        COMPLETED: 'COMPLETED'
    };

    return O2Session;
})();
