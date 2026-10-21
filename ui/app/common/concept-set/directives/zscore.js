'use strict';

angular.module('bahmni.common.conceptSet')
    .directive('zscore', ['appService', '$http', function (appService, $http) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                abnormalObs: '=?',
                patient:'='
            },

            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {
                $scope.inner_value
                $scope.catagories = [
                    {name: "BMI Z-Score", value: "bmi", unit: "", ent_name: "BMI", sec_unit: "CM", sec_name: "Height", thir_unit: "KG", thir_name: "Weight"},
                    {name:"Head Circumference Z-Score", value: "hcfa", unit: "CM", ent_name: "Head Circumference"},
                    {name:"Length Height For Age Z-Score", value: "lhfa", unit: "CM", ent_name: "length/height"},
                    {name:"Weight for Age Z-Score", value: "wfa", unit: "KG", ent_name: "Weight"}, 
                    {name:"Weight for Height Z-Score", value: "wfl", unit: "KG", ent_name: "Weight", sec_unit: "CM", sec_name: "Height"}
                ];
            
                var load = function () {
                    return appService.loadConfig('z_score.json').then(res => {
                        $scope.lookup = res
                    })
                };
                var calculateBMI = function(hei, wei){
                    var height = hei/100
                    var bmi_score = (wei / (height*height)).toFixed(2);
                    return bmi_score
                }
                var formData = function (patientUuid) {
                    var params = {
                        s: "byPatientUuid",
                        patient: patientUuid,
                        numberOfVisits: 1,
                        v: "visitFormDetails",
                        conceptNames: ["BMI"],
                        patientProgramUuid: null
                    };
                    return $http.get(Bahmni.Common.Constants.formDataUrl, {params: params});
                };
                $scope.initz = function(){
                    // Set actSelected based on observation.concept.name
                    var conceptName = ($scope.observation.concept.name || '');
                    $scope.actSelected = $scope.catagories.find(function(cat) {
                        return (cat.name || '') === conceptName;
                    });
                    $scope.inner_value = undefined;
                    $scope.sec_value = undefined;
                    $scope.thir_value = undefined;
                    $scope.lookupError = undefined;
                    load();
                    formData($scope.patient.uuid).then(res => {
                        $scope.bmi = res.data
                    })
                }
                var setLookupError = function (message) {
                    $scope.observation.value = undefined;
                    $scope.lookupError = message;
                };
                var buildLookupError = function (lookupRows, lookupIndex, indexName, unit) {
                    var keys = Object.keys(lookupRows || {}).map(function (key) {
                        return Number(key);
                    }).filter(function (value) {
                        return !isNaN(value);
                    }).sort(function (a, b) {
                        return a - b;
                    });
                    if (!keys.length) {
                        return "Unable to calculate z-score: lookup data is unavailable.";
                    }
                    var min = keys[0];
                    var max = keys[keys.length - 1];
                    var unitLabel = unit ? " " + unit : "";
                    return indexName + " is outside the WHO table range (" + min + " - " + max + unitLabel + ").";
                };
                var completedMonthsBetween = function (startDate, endDate) {
                    var months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
                    months += endDate.getMonth() - startDate.getMonth();
                    if (endDate.getDate() < startDate.getDate()) {
                        months--;
                    }
                    return Math.max(months, 0);
                };
                var patientAge = function () {
                    var oneWeek = 1000 * 60 * 60 * 24 * 7;
                    var date1 = new Date($scope.patient.birthdate);
                    var date2 = new Date();
                    return {
                        weeks: Math.floor((date2.getTime() - date1.getTime()) / oneWeek),
                        months: completedMonthsBetween(date1, date2)
                    };
                };
                var ageLabel = function (months) {
                    var years = Math.floor(months / 12);
                    var remainingMonths = months % 12;
                    if (years > 0 && remainingMonths > 0) {
                        return years + "y " + remainingMonths + "m";
                    }
                    if (years > 0) {
                        return years + "y";
                    }
                    return months + "m";
                };
                var unsupportedAgeMessage = function (selectedCategory, months) {
                    var patientAgeLabel = ageLabel(months);
                    if (selectedCategory === "wfa") {
                        return "Cannot calculate WHO weight-for-age z-score at " + patientAgeLabel + ": WHO provides weight-for-age only through 10 years.";
                    }
                    if (selectedCategory === "hcfa") {
                        return "Cannot calculate WHO head circumference-for-age z-score at " + patientAgeLabel + ": WHO provides head circumference-for-age only through 5 years.";
                    }
                    return "Unable to calculate z-score for this age range.";
                };
                var usesBmiForAgeReference = function (selectedCategory, months) {
                    return selectedCategory === "wfl" && months > 60 && months <= 228;
                };
                var sheetMatchesAny = function (sheet, patterns) {
                    return patterns.some(function (pattern) {
                        return sheet.includes(pattern);
                    });
                };
                var lookupCategoryValues = function (selectedCategory, months) {
                    if (usesBmiForAgeReference(selectedCategory, months)) {
                        return ["bmi"];
                    }
                    if (selectedCategory === "wfl") {
                        return ["wfl", "wfh"];
                    }
                    return [selectedCategory];
                };
                var selectAgeBasedLookup = function (sheets, selectedCategory, weeks, months) {
                    var candidateRanges = [];
                    if (selectedCategory === "wfl") {
                        if (months <= 60) {
                            if (months >= 24) {
                                candidateRanges.push({patterns: ["2-to-5"], index: months});
                            }
                            candidateRanges.push({patterns: ["0-to-5", "0-5"], index: months});
                        }
                    } else {
                        if (weeks <= 13) {
                            candidateRanges.push({patterns: ["0-to-13", "0-13"], index: weeks});
                        }
                        if (months <= 24) {
                            candidateRanges.push({patterns: ["0-to-2"], index: months});
                        }
                        if (months <= 60) {
                            candidateRanges.push({patterns: ["2-to-5", "0-to-5", "0-5"], index: months});
                        }
                        if (selectedCategory === "wfa" && months <= 120) {
                            candidateRanges.push({patterns: ["5-to-10"], index: months});
                        }
                        if ((selectedCategory === "lhfa" || selectedCategory === "bmi") && months <= 228) {
                            candidateRanges.push({patterns: ["5-to-19"], index: months});
                        }
                    }

                    for (var rangeIndex = 0; rangeIndex < candidateRanges.length; rangeIndex++) {
                        var candidate = candidateRanges[rangeIndex];
                        var matchedSheet = sheets.find(function (sheet) {
                            return sheetMatchesAny(sheet, candidate.patterns);
                        });
                        if (matchedSheet) {
                            return {sheet: matchedSheet, index: candidate.index};
                        }
                    }
                };
                var isValidPositiveNumber = function (value) {
                    return value !== undefined && value !== null && value !== "" && !isNaN(Number(value)) && Number(value) > 0;
                };
                var measurementUnit = function () {
                    if ($scope.actSelected.value === "bmi") {
                        return "kg/m2";
                    }
                    return $scope.actSelected.unit;
                };
                var validateMeasurementRange = function (measurement, targetRow, label, unit) {
                    if (!targetRow || targetRow.length < 10) {
                        return true;
                    }
                    var min = targetRow[3];
                    var max = targetRow[9];
                    if (measurement < min || measurement > max) {
                        setLookupError(label + " is outside the WHO z-score table range for this patient (" + min + " - " + max + (unit ? " " + unit : "") + ").");
                        return false;
                    }
                    return true;
                };
                $scope.showlookup = function(){
                    $scope.lookupError = undefined;
                    if (!$scope.lookup) {
                        setLookupError("Unable to calculate z-score: lookup data is still loading.");
                        return;
                    }
                    var gender = "boys";
                    var age = patientAge();
                    var weeks = age.weeks;
                    var months = age.months;
                    if($scope.patient.gender == "F"){
                        gender = "girls";
                    }
                    var useBmiForAgeReference = usesBmiForAgeReference($scope.actSelected.value, months);
                    var referenceCategory = useBmiForAgeReference ? "bmi" : $scope.actSelected.value;
                    var lookupCategories = lookupCategoryValues($scope.actSelected.value, months);
                    var filtered_sheet = Object.keys($scope.lookup).filter(excl_sheet => {
                        return lookupCategories.some(function (category) {
                            return excl_sheet.includes(category);
                        }) && excl_sheet.includes(gender);
                    });
                    var selectedLookup = selectAgeBasedLookup(filtered_sheet, referenceCategory, weeks, months);

                    if(selectedLookup){
                        var ind = selectedLookup.index;
                        var measurement;
                        var measurementLabel = $scope.actSelected.ent_name;
                        var measurementUnitLabel = measurementUnit();
                        if (useBmiForAgeReference) {
                            if (!isValidPositiveNumber($scope.inner_value)) {
                                setLookupError("Enter a valid " + $scope.actSelected.ent_name + ".");
                                return;
                            }
                            if (!isValidPositiveNumber($scope.sec_value)) {
                                setLookupError("Enter a valid " + $scope.actSelected.sec_name + ".");
                                return;
                            }
                            ind = months;
                            measurement = Number(calculateBMI($scope.sec_value, $scope.inner_value));
                            measurementLabel = "BMI";
                            measurementUnitLabel = "kg/m2";
                        }
                        else if($scope.actSelected.thir_name){
                            if (!isValidPositiveNumber($scope.sec_value)) {
                                setLookupError("Enter a valid " + $scope.actSelected.sec_name + ".");
                                return;
                            }
                            if (!isValidPositiveNumber($scope.thir_value)) {
                                setLookupError("Enter a valid " + $scope.actSelected.thir_name + ".");
                                return;
                            }
                            measurement = Number(calculateBMI($scope.sec_value, $scope.thir_value));
                            $scope.inner_value = measurement;
                        }
                        else if($scope.actSelected.sec_name){
                            if (!isValidPositiveNumber($scope.sec_value)) {
                                setLookupError("Enter a valid " + $scope.actSelected.sec_name + ".");
                                return;
                            }
                            ind = Number($scope.sec_value);
                            measurement = Number($scope.inner_value);
                        }
                        else if (!isValidPositiveNumber($scope.inner_value)) {
                            setLookupError("Enter a valid " + $scope.actSelected.ent_name + ".");
                            return;
                        } else {
                            measurement = Number($scope.inner_value);
                        }

                        var lookupRows = $scope.lookup[selectedLookup.sheet];
                        var target_row = lookupRows[ind.toString()];
                        if (!target_row || target_row.length < 3) {
                            var indexName = useBmiForAgeReference ? "Age" : ($scope.actSelected.sec_name || "Age");
                            var unit = useBmiForAgeReference ? "months" : ($scope.actSelected.sec_unit || "months");
                            setLookupError(buildLookupError(lookupRows, Number(ind), indexName, unit));
                            return;
                        }
                        if (!validateMeasurementRange(measurement, target_row, measurementLabel, measurementUnitLabel)) {
                            return;
                        }
                        var L = target_row[0];
                        var M = target_row[1];
                        var S = target_row[2];
                        $scope.observation.value = (0 + ((((measurement/M)**L) - 1)/ (L*S))).toString();
                        $scope.observation.comment = $scope.selectedType;
                        console.log($scope.selectedType);
                    } else {
                        setLookupError(unsupportedAgeMessage($scope.actSelected.value, months));
                    }
                }
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/zscore.html'
        };
    }]);
