'use strict';

Bahmni.Clinical.VisitHistoryEntry = (function () {
    var VisitHistoryEntry = function (visitData) {
        angular.extend(this, visitData);
    };

    VisitHistoryEntry.prototype = {
        isActive: function () {
            return this.stopDatetime === null;
        },

        isMedico: function () {
            if(!this.attributes || !this.attributes.length) {
                return false;
            }
            var isMedicoLegalAttribute = function (attr) {
                var d = attr && attr.display ? String(attr.display).trim() : '';
                return /^Medico Legal Cases?:\s*true\s*$/i.test(d);
            };
            return _.some(this.attributes, isMedicoLegalAttribute);
        },

        isFromCurrentLocation: function (currentVisitLocation) {
            var visitLocation = _.get(this.location, 'uuid');
            return visitLocation === currentVisitLocation;
        },

        isOneDayVisit: function () {
            if (this.isActive()) {
                return true;
            }
            var startDateString = moment(this.startDatetime).format("YYYYMMDD");
            var stopDateString = moment(this.stopDatetime).format("YYYYMMDD");
            return startDateString === stopDateString;
        },

        getVisitType: function () {
            if (this.visitType) {
                return this.visitType.name || this.visitType.display;
            }
        }
    };

    return VisitHistoryEntry;
})();

