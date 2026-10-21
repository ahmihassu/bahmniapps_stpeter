'use strict';

Bahmni.Common.Obs.Observation = (function () {
    var Observation = function (obs, conceptConfig) {
        angular.extend(this, obs);
        this.concept = obs.concept;
        this.conceptConfig = conceptConfig;
    };

    Observation.prototype = {
        isTraumaChart: function(){
            return this.concept.conceptClass == "trauma_chart"
        },
        isCervicalMap: function(){
            return this.concept.conceptClass == "cervical_map"
        },
        isColon: function(){
            return this.concept.conceptClass == "colon"
        },
        isEndo: function(){
            return this.concept.conceptClass == "endo"
        },
        isMedicationChart: function(){
            return this.concept.conceptClass == "Medication_Chart"
        },
        isDrugChart: function(){
            return this.concept.conceptClass == "drug_chart"
        },
        isTable: function (){
            return this.concept.conceptClass == "tab"
        },
        isChart: function () {
            return this.concept.conceptClass=="Burn Chart"
        },
        isFormElement: function () {
            return this.groupMembers && this.groupMembers.length <= 0;
        },

        isImageConcept: function () {
            return this.concept.conceptClass === "Image";
        },
        isVideoConcept: function () {
            return this.concept.conceptClass === "Video";
        },
        isAtypicalConcept: function () {
            return this.concept.conceptClass === "Graph" || this.concept.conceptClass === "Horizontal Table" || this.concept.conceptClass === "Contraction Chart"  || this.concept.conceptClass == "tab"   || this.concept.conceptClass === "richText";
        },
        isGraph: function () {
            return this.concept.conceptClass === "Graph";
        },
        isHTable: function () {
            return this.concept.conceptClass === "Horizontal Table";
        },
        isCChart: function () {
            return this.concept.conceptClass === "Contraction Chart";
        },
        isRichText: function () {
            return this.concept.conceptClass === "richText";
        },
        hasPDFAsValue: function () {
            return (this.value.indexOf(".pdf") > 0);
        },

        isComplexConcept: function () {
            return this.concept.dataType === "Complex";
        },

        getComplexDataType: function () {
            return this.complexData ? this.complexData.dataType : null;
        },

        isLocationRef: function () {
            return this.isComplexConcept() && this.getComplexDataType() === "Location";
        },

        isProviderRef: function () {
            return this.isComplexConcept() && this.getComplexDataType() === "Provider";
        },

        getDisplayValue: function () {
            var value;
            if(this.concept.conceptClass=="Burn Chart"){
                return JSON.parse(this.value)["cc"] + "%"
            }
            if(this.concept.conceptClass == "Medication_Chart"){
                return ""
            }
            if(this.concept.conceptClass == "trauma_chart"){
                return ""
            }
            if(this.concept.conceptClass == "cervical_map"){
                return ""
            }
            if(this.concept.conceptClass == "colon"){
                return ""
            }
             if(this.concept.conceptClass == "endo"){
                return ""
            }
            var value;
            if (this.type === "Boolean" || this.concept && this.concept.dataType === "Boolean") {
                return this.value === true ? "OBS_BOOLEAN_YES_KEY" : "OBS_BOOLEAN_NO_KEY";
            }
            if (this.type === "Datetime" || this.concept && this.concept.dataType === "Datetime") {
                var date = Bahmni.Common.Util.DateUtil.parseDatetime(this.value);
                return date != null ? Bahmni.Common.Util.DateUtil.formatDateWithTime(date) : "";
            }
            if (this.conceptConfig && this.conceptConfig.displayMonthAndYear) {
                value = Bahmni.Common.Util.DateUtil.getDateInMonthsAndYears(this.value);
                if (value != null) {
                    return value;
                }
            }
            if (this.type === "Date" || this.concept && this.concept.dataType === "Date") {
                return this.value ? Bahmni.Common.Util.DateUtil.formatDateWithoutTime(this.value) : "";
            }

            if (this.isLocationRef()) {
                return this.complexData.display;
            }

            if (this.isProviderRef()) {
                return this.complexData.display;
            }

            value = this.value;
            var displayValue = value && (value.shortName || (value.name && (value.name.name || value.name)) || value);
            if (this.duration) {
                displayValue = displayValue + " " + this.getDurationDisplayValue();
            }
            return displayValue;
        },

        getDurationDisplayValue: function () {
            var durationForDisplay = Bahmni.Common.Util.DateUtil.convertToUnits(this.duration);
            return "since " + durationForDisplay["value"] + " " + durationForDisplay["unitName"];
        }
    };

    return Observation;
})();

