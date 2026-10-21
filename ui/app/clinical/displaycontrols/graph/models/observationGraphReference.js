(function () {
    "use strict";

    Bahmni = Bahmni || {};
    Bahmni.Clinical = Bahmni.Clinical || {};

    var normalizeGender = function (gender) {
        if (gender === undefined || gender === null) {
            return gender;
        }
        var upper = String(gender).toUpperCase();
        if (upper === "M" || upper === "MALE") {
            return "M";
        }
        if (upper === "F" || upper === "FEMALE") {
            return "F";
        }
        return gender;
    };

    var parseNumericCell = function (cell) {
        if (cell === undefined || cell === null || cell === "") {
            return cell;
        }
        var numericValue = parseFloat(cell);
        return isNaN(numericValue) ? cell : numericValue;
    };

    Bahmni.Clinical.ObservationGraphReference = function (csvString, config, gender, ageInMonths, yAxisUnit) {
        var that = this;
        var monthBuffer = 1;
        this.config = config;
        this.csvString = csvString;
        this.yAxisUnit = yAxisUnit;
        this.referenceChartValues = asMatrix(this.csvString);
        this.header = this.referenceChartValues.shift();
        this.xAxisConceptColumnIndex = _.findIndex(this.header, function (columnName) {
            return columnName.toLowerCase() === that.config.xAxisConcept.toLowerCase();
        });
        this.genderColumnIndex = _.findIndex(this.header, function (columnName) {
            return columnName.toLowerCase() === Bahmni.Clinical.Constants.gender.toLowerCase();
        });

        var patientGender = normalizeGender(gender);
        var maxNoOfMonths = (ageInMonths !== undefined && ageInMonths !== null && !isNaN(ageInMonths))
            ? ageInMonths + monthBuffer
            : undefined;
        this.referenceChartValues = _.filter(this.referenceChartValues, function (value) {
            var rowGender = normalizeGender(value[that.genderColumnIndex]);
            if (rowGender !== patientGender) {
                return false;
            }
            if (that.config.displayForAge()) {
                var ageValue = parseNumericCell(value[that.xAxisConceptColumnIndex]);
                if (maxNoOfMonths === undefined) {
                    return true;
                }
                return ageValue <= maxNoOfMonths;
            }
            return true;
        });
    };

    var asMatrix = function (csvString) {
        return _.map(csvString.split("\n"), function (line) {
            return line.split(",");
        });
    };

    Bahmni.Clinical.ObservationGraphReference.prototype.createValues = function (columnName) {
        var that = this;
        return _.map(this.referenceChartValues, function (rowOfValues) {
            var point = {};
            point[columnName] = parseNumericCell(rowOfValues[that.header.indexOf(columnName)]);
            point[that.config.xAxisConcept] = parseNumericCell(rowOfValues[that.xAxisConceptColumnIndex]);
            return point;
        });
    };

    Bahmni.Clinical.ObservationGraphReference.prototype.createObservationGraphReferenceLines = function () {
        var that = this;
        var headersToBeExcluded = function (column, index) {
            return index === that.genderColumnIndex || index === that.xAxisConceptColumnIndex;
        };

        var newObservationGraphLine = function (columnName) {
            return new Bahmni.Clinical.ObservationGraphLine({
                name: columnName,
                reference: true,
                unit: that.yAxisUnit,
                units: that.yAxisUnit,
                values: that.createValues(columnName)
            });
        };

        return _(this.header)
            .reject(headersToBeExcluded)
            .map(newObservationGraphLine)
            .value();
    };

    Bahmni.Clinical.ObservationGraphReference.prototype.validate = function () {
        if (this.xAxisConceptColumnIndex === -1) {
            throw new Error(this.config.xAxisConcept + " column is not defined in reference lines csv: " + this.config.getReferenceDataFileName());
        }
        if (this.genderColumnIndex === -1) {
            throw new Error("Gender column is not defined in reference lines csv: " + this.config.getReferenceDataFileName());
        }
    };
})();
