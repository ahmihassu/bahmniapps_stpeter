'use strict';

angular.module('bahmni.common.conceptSet')
    .directive('concept', ['$http', 'RecursionHelper', 'spinner', '$filter', 'messagingService', '$rootScope', '$translate', 'observationsService',
        function ($http, RecursionHelper, spinner, $filter, messagingService, $rootScope, $translate, observationsService) {
            var link = function (scope) {
                var hideAbnormalbuttonConfig = scope.observation && scope.observation.conceptUIConfig && scope.observation.conceptUIConfig['hideAbnormalButton'];
                scope.summernoteContent = '';
                scope.now = moment().format("YYYY-MM-DD hh:mm:ss");
                scope.showTitle = scope.showTitle === undefined ? true : scope.showTitle;
                scope.hideAbnormalButton = hideAbnormalbuttonConfig == undefined ? scope.hideAbnormalButton : hideAbnormalbuttonConfig;
                scope.inTable = scope.inTable === undefined ? false : scope.inTable;

                  // Check if the observation description includes "required" and add conceptUIConfig                  
                if (scope.observation && scope.observation.concept && scope.observation.concept.description) {
                    var description = scope.observation.concept.description.split('**').join('');
                    if (description.includes('required')) {
                        scope.observation.conceptUIConfig = scope.observation.conceptUIConfig || {};
                        scope.observation.conceptUIConfig.required = true;
                    }
                }

                scope.cloneNew = function (observation, parentObservation) {
                    observation.showAddMoreButton = function () {
                        return false;
                    };
                    var newObs = observation.cloneNew();
                    newObs.scrollToElement = parentObservation.concept.conceptClass != "Table" ? true : false
                    var index = parentObservation.groupMembers.indexOf(observation);
                    parentObservation.groupMembers.splice(index + 1, 0, newObs);
                    messagingService.showMessage("info", $translate.instant("NEW_KEY") + " " + observation.label + " " + $translate.instant("SECTION_ADDED_KEY"));
                    scope.$root.$broadcast("event:addMore", newObs);
                };
                scope.diagnosisList = []
                scope.checkTable = function () {
                    return scope.inTable;
                }
                var getAllFor = function (searchTerm) {
                    var url = Bahmni.Common.Constants.emrapiConceptUrl;
                    var parameters = { term: searchTerm, limit: 5 };
                    return $http.get(url, {
                        params: parameters
                    });
                };
                scope.refreshList = function (obs) {
                    getAllFor(obs.value).then(x => obs.diagnosisList = x.data)
                }
                scope.firstTog = function (chk, member) {
                    if (chk == "Results(Cross Match)") {
                        member.removeTogglebtn = true
                        member.resultOnly = true
                        member.tableRows = 20
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                    }
                    else if (chk == "Result(TB)") {
                        member.removeTogglebtn = true
                        member.resultOnly = true
                        member.tableRows = 20
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                    }
                    else if (chk == "Result(FNAC)") {
                        member.removeTogglebtn = true
                        member.resultOnly = true
                        member.tableRows = 20
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                    }
                    else if (chk == "Result(PMORPH)") {
                        member.removeTogglebtn = true
                        member.resultOnly = true
                        member.tableRows = 20
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                    }
                    else if (member.concept.name == "") {
                        member.removeTogglebtn = true
                        member.resultOnly = true
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                        member.tableRows = 1
                    }
                    else if (member.concept.name == "tbrf, patient address" || member.concept.name == "tbrf, tb disease type and treatment history" || member.concept.name == "tbrf, request for testing at TB laboratory") {
                        member.tableRows = 5
                        member.resultOnly = false
                        member.removeTogglebtn = false
                        if (chk == "TB Request Form") {
                            member.tableRows = 1
                            member.resultOnly = true
                            member.removeTogglebtn = true
                            if (!member.inTable) {
                                scope.toggleInTable(member)
                            }
                        }
                    }
                    else if (member.concept.name == "FNAC request form") {
                        member.removeTogglebtn = true
                        member.resultOnly = true
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                        member.tableRows = 1
                    }
                    else if (member.concept.name == "Peripheral morphology request form") {
                        member.removeTogglebtn = true
                        member.resultOnly = true
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                        member.tableRows = 1
                    }
                    else if (member.concept.name == "Cross Match Table") {
                        member.tableRows = 20
                        member.removeTogglebtn = true
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                        clrTbl(member);
                        if (chk == "Results(Cross Match)") member.resultOnly = true
                    }
                    else if (member.concept.name == "tbrfr, TB Test Result Form") {
                        member.tableRows = 5
                        member.resultOnly = false
                        member.removeTogglebtn = false
                        var newset = member.groupMembers.filter(function (mr) {
                            if (scope.patient.specTsestType == "tbrf, microscopy") return mr.concept.name == "tbrfr, Microscopic Examination"
                            if (scope.patient.specTsestType == "tbrf, genexpert") return mr.concept.name == "tbrfr,Genexpert"
                            if (scope.patient.specTsestType == "tbrf, culture") return mr.concept.name == "tbrfr, tb culutre result"
                            if (scope.patient.specTsestType == "tbrf, phenotypic dst 1") return mr.concept.name == "tbrfr, DST"
                            if (scope.patient.specTsestType == "tbrf, phenotypic dst 2") return mr.concept.name == "tbrfr, DST 2"
                            if (scope.patient.specTsestType == "tbrf, lpa") return mr.concept.name == "tbrfr, Line Probe Assay"
                        })
                        member.groupMembers = newset

                    }
                    else if (member.concept.name == "FNAC Report") {
                        member.tableRows = 20
                        member.removeTogglebtn = true
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                        clrTbl(member);
                        if (chk == "Result(FNAC)") member.resultOnly = true
                    }
                    else if (member.concept.name == "Peripheral morphology Result form") {
                        member.tableRows = 20
                        member.removeTogglebtn = true
                        if (!member.inTable) {
                            scope.toggleInTable(member)
                        }
                        clrTbl(member);
                        if (chk == "Result(PMORPH)") member.resultOnly = true
                    }
                    else {
                        member.tableRows = 5
                        member.resultOnly = false
                        member.removeTogglebtn = false
                    }

                }

                var clrTbl = function (member) {
                    member.flat.forEach(val => val.value = null);
                }
                scope.toggleInTable = function (member) {
                    member.inTable = !member.inTable;
                    if (member.inTable) {
                        member.flat = member.groupMembers
                        member.flat = scope.flatten(member)
                        member.allLabels = member.flat
                        var uuids = member.flat.map((aa) => aa.concept.uuid)
                    }

                    if (member.inTable) {
                        var params = {
                            q: "prev_value_fetcher",
                            v: "full",
                            concept_uuid: uuids.toString(),
                            patient_identifier: scope.patient.identifier
                        };


                        $http.get(Bahmni.Common.Constants.sqlUrl, {
                            method: "GET",
                            params: params,
                            withCredentials: true
                        }).then((result) => getPreviousValues(result.data, member));
                    }
                }
                scope.flatten = function (obs) {
                    var gm = [];
                    for (var i = 0; i < 5; i++) {
                        gm = [];
                        obs.flat.map(function (innerobs, ind) {
                            if (innerobs.groupMembers.length > 0) {
                                gm.push(...innerobs.groupMembers)
                            }
                            else gm.push(innerobs)
                        })
                        obs.flat = gm
                    }
                    return obs.flat
                }

                var getPreviousValues = function (result, member) {
                    let allRowsObj = {}
                    let allRows = []
                    result.forEach(r => {
                        try {
                            if (allRowsObj[r.date.toString()][r.concept]) {
                                allRowsObj[r.date.toString()][r.concept] = allRowsObj[r.date.toString()][r.concept] + ", " + r.answer;
                            }
                            else {
                                allRowsObj[r.date.toString()][r.concept] = r.answer;
                            }

                        }
                        catch {
                            allRowsObj[r.date.toString()] = {};
                            allRowsObj[r.date.toString()]['date'] = new Date(r.date);
                            member.flat.forEach(function (ob) {
                                allRowsObj[r.date.toString()][ob.concept.name] = "";
                            })
                            allRowsObj[r.date.toString()][r.concept] = r.answer;
                        }


                    });

                    Object.keys(allRowsObj).forEach(r => {
                        allRows.unshift(allRowsObj[r])
                    })
                    let altrows = []
                    let currval = {}
                    allRows.forEach((currentValue, index, arr) => {
                        Object.keys(currentValue).forEach(q => {
                            if (index == 0) { currval = { ...currentValue } }
                            else if (currentValue[q] == "") { currval[q] = altrows[index - 1][q] }
                            else { currval[q] = currentValue[q] }
                        })
                        altrows.push({ ...currval })
                    })
                    while (altrows.length > member.tableRows) {
                        altrows.shift()
                    }
                    member.allRows = altrows

                }
                scope.isDateRes = function (res) {
                    if (res && res.split('-').length == 3 && res.split(':').length == 3) return true
                    return false
                }

                var getFirstEntry = async function (obs) {
                    var first_entry;
                    var min_date = new Date();
                    for (let i = 0; i < obs.groupMembers.length; i++) {
                        let member = obs.groupMembers[i];
                        var res = await formData(scope.patient.uuid, 1, [member.concept.name])
                        if (res.data.results.length > 0) {
                            first_entry = new Date(res.data.results[res.data.results.length - 1].obsDatetime)
                            if (first_entry < min_date) min_date = first_entry;
                        }
                    }
                    return min_date
                }

                var cloneNtimes = function (obs, n) {
                    // Because 'Time' is the 7th group member of the 'Therapeutic diet, SAM' set.
                    return new Promise(function (resolve, reject) {
                        for (let i = 1; i < n; i++) {
                            scope.cloneNew(obs.groupMembers[7], obs)
                        }
                    })

                }

                scope.initTable = async function (obs) {
                    if (obs.concept.shortName.includes("Antibiotics")) {
                        obs.isAntibiotic = true
                    }
                    scope.days = ["Adm", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

                    if (obs.concept.name == "Therapeutic diet, SAM")
                        cloneNtimes(obs, 12)

                    var first_entry = await getFirstEntry(obs)

                    obs.groupMembers.forEach(function (member) {
                        member.values = []
                        for (var i = 0; i < scope.days.length; i++) {
                            member.values.push("")
                        }

                        if (scope.isClone(member, obs)) member.hide = true

                        if (!scope.isClone(member, obs)) {

                            formData(scope.patient.uuid, 1, [member.concept.name]).then(function (res) {

                                var prev_order = -1;
                                let count = 18;//18 because the 11 clones of 'Time' concept span positions 7 to 18
                                res.data.results.forEach(function (result) {

                                    if (member.concept.name != "Time set, therapeutic, SAM") {
                                        var order = Math.round((new Date(result.obsDatetime) - first_entry) / 86400000)
                                        if (order != prev_order)
                                            member.values[order] = result.display.split(":")[1].trim()
                                        prev_order = order
                                    }

                                    if (member.concept.name == "Time set, therapeutic, SAM") {

                                        var order = Math.round((new Date(result.obsDatetime) - first_entry) / 86400000)

                                        if (order == prev_order) {
                                            obs.groupMembers[count].values[order] = result.display.split(":")[1].trim()
                                            count--
                                            prev_order = order
                                        }

                                        else {
                                            count = 18
                                            obs.groupMembers[count].values[order] = result.display.split(":")[1].trim()
                                            prev_order = order
                                            count--
                                        }
                                    }
                                })
                                if (member.concept.name == "Time set, therapeutic, SAM") {
                                    member.concept.shortName += " 1"
                                    shiftCells(obs)
                                }
                            })

                        }

                    })
                    removeClonedObs(obs)
                }

                var shiftCells = function (obs) {
                    renameClones(obs)
                    let lastIndexOfClone = 18
                    let indexOfTimeConcept = 7
                    let members = obs.groupMembers;
                    for (let i = 0; i < 12; i++) {
                        for (let j = lastIndexOfClone; j > indexOfTimeConcept; j--) {
                            for (let k = 0; k < scope.days.length; k++) {
                                if (members[j - 1].values[k] == "" && members[j].values[k] != "") {
                                    members[j - 1].values[k] = members[j].values[k]
                                    members[j].values[k] = ""
                                }
                            }
                        }
                    }
                }

                var renameClones = function (obs) {
                    let members = obs.groupMembers;
                    let timeNo = 2
                    for (let i = 8; i < 19; i++) {
                        members[i].concept.shortName += " " + timeNo
                        timeNo += 1
                    }
                }

                var removeClonedObs = function (obs) {
                    let count = 0
                    for (let i = 19; i < obs.groupMembers.length; i++) {
                        if (obs.groupMembers[i].label == "Time") count++
                    }

                    obs.groupMembers.splice(19, count)
                }


                scope.makeWeightChart = async function (obs) {
                    await obs.uniqueId;
                    var high, low, values = []
                    var memberNames = []
                    var members = obs.groupMembers;
                    memberNames.push(members[0].concept.name, members[1].concept.name, members[2].concept.name)
                    await formData(scope.patient.uuid, 1, memberNames[0]).then(function (res) {
                        //console.log(res)
                        let result = res.data.results
                        if (result.length > 0)
                            high = Number(result[0].display.replace(/^\D+/g, ''))
                    })
                    await formData(scope.patient.uuid, 1, memberNames[1]).then(function (res) {

                        let result = res.data.results
                        if (result.length > 0)
                            low = Number(result[0].display.replace(/^\D+/g, ''))
                    })
                    await formData(scope.patient.uuid, 1, memberNames[2]).then(function (res) {
                        //console.log(res)
                        var first_entry;
                        var prev_order = -1
                        if (res.data.results.length > 0)
                            first_entry = new Date(res.data.results[res.data.results.length - 1].obsDatetime)
                        res.data.results.forEach(function (result) {
                            var order = Math.round((new Date(result.obsDatetime) - first_entry) / 86400000)
                            if (order != prev_order)
                                values[order] = result.display.split(":")[1].trim()
                            prev_order = order
                        })

                    })

                    var bindToElement = document.getElementById(obs.uniqueId);
                    var chart = Bahmni.Graph.c3Chart.create();
                    chart.weightChart(bindToElement, low, high, values)

                }

                scope.removeClonedObs = function (observation, parentObservation) {
                    observation.voided = true;
                    var lastObservationByLabel = _.findLast(parentObservation.groupMembers, function (groupMember) {
                        return groupMember.label === observation.label && !groupMember.voided;
                    });

                    lastObservationByLabel.showAddMoreButton = function () { return true; };
                    observation.hidden = true;
                };
                scope.isClone = function (observation, parentObservation) {
                    if (parentObservation && parentObservation.groupMembers) {
                        var index = parentObservation.groupMembers.indexOf(observation);
                        return (index > 0) ? parentObservation.groupMembers[index].label == parentObservation.groupMembers[index - 1].label : false;
                    }
                    return false;
                };
                var isNumeric = function (str) {
                    if (typeof str != "string") return false // we only process strings!  
                    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
                        !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
                }

                var formData = function (patientUuid, numberOfVisits, formGroup, patientProgramUuid) {
                    var params = {
                        s: "byPatientUuid",
                        patient: patientUuid,
                        numberOfVisits: numberOfVisits,
                        v: "visitFormDetails",
                        conceptNames: formGroup || null,
                        patientProgramUuid: patientProgramUuid || null
                    };
                    return $http.get(Bahmni.Common.Constants.formDataUrl, { params: params });
                };


                scope.isRemoveValid = function (observation) {
                    if (observation.getControlType() == 'image') {
                        return !observation.value;
                    }
                    return true;
                };

                scope.getStringValue = function (observations) {
                    return observations.map(function (observation) {
                        return observation.value + ' (' + $filter('bahmniDate')(observation.date) + ")";
                    }).join(", ");
                };

                scope.toggleSection = function () {
                    scope.collapse = !scope.collapse;
                };

                scope.isCollapsibleSet = function () {
                    return scope.showTitle == true;
                };

                scope.hasPDFAsValue = function () {
                    return scope.observation.value && (scope.observation.value.indexOf(".pdf") > 0);
                };

                scope.$watch('collapseInnerSections', function () {
                    scope.collapse = scope.collapseInnerSections && scope.collapseInnerSections.value;
                });




                scope.$on('calculateStuff', function (event, args) {
                    if (scope.observation?.concept?.name == "Triage Score Result") {
                        scope.observation.value = args.val
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                    if (scope.observation.concept.name == "Triage Color Result") {
                        scope.observation.value = args.col
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                    if (scope.observation.concept.name == "ASOS Score") {
                        if(args.val >= 10){
                            scope.observation.value = args.val + "(" + args.str + ")"
                        } else{
                            scope.observation.value = args.val
                        }
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                });
                 scope.$on('calculateToxicology', function (event, args) {
                    if (scope.observation?.concept?.name == "TEWS SCORE") {
                        if(args.val >= 10){
                            scope.observation.value = args.val
                        } else{
                            scope.observation.value = args.val
                        }
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                });
                scope.$on('calculateICUUrine', function (event, args) {
                    if (scope.observation.concept.name == "Total output") {
                        scope.observation.value = args.val
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                });

                scope.$on('calculateBMI', function (event, args) {
                    if (scope.observation.concept.name == "BMI") {
                        scope.observation.value = args.score
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                    if (scope.observation.concept.name == "BMI STATUS") {
                        scope.observation.value = args.status
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }

                });

                scope.$on('calculateNDSScore', function (event, args) {
                    if (scope.observation.concept.name == "TOTAL NDS SCORE") {
                        if(args.val >= 10){
                            scope.observation.value = args.val
                        } else{
                            scope.observation.value = args.val
                        }
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                })

                scope.$on('calculateIWGDFValue', function (event, args) {
                    if (scope.observation.concept.name == "IWGDF Score") {
                        scope.observation.value = args.val
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                })

                scope.$on('calculateAldreteValue', function (event, args) {
                    if (scope.observation?.concept?.name == "Total Score (Nine or more score for recovery to be confirmed)") {
                        scope.observation.value = args.val
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                })

                scope.$on('calculateWaistCircumference', function (event, args) {
                    if (scope.observation.concept.name == "Waist Circumference Interpretation") {
                        scope.observation.value = args.val
                        scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    }
                })


                scope.$on('setRiskCategory', function (event, args) {
                    if (scope.observation.concept.name !== "Risk Category//" || args.val === undefined )  return;
                        scope.observation.value = scope.observation.concept.answers[args.val];

            })

                scope.$on('setVitalAbnormality', function (event, args) {
                    if (scope.observation.concept.name !== "Vital Abnormality" || args.val === undefined )  return;
                        scope.observation.value = args.val;

            })



                scope.$on('setEligibility', function (event, args) {
                    if (scope.observation.concept.name == "If  shows clinical signs" && args.val){
                            scope.observation.value = scope.observation.concept.answers[0]
                        }
                    else if (scope.observation.concept.name == "If  shows clinical signs" && !args.val){
                        scope.observation.value = undefined
                }
            })

                scope.$on('lnmpUpdated', function (event, args) {
                    if (scope.observation.concept.name === "Gestational Age(GA)") {
                        // Calculate the gestational age
                        const lnmpDate = new Date(args.lnmpDate);
                        const currentDate = new Date();
                        const diffInDays = Math.floor((currentDate - lnmpDate) / (1000 * 60 * 60 * 24));
                        const gestationalAgeInWeeks = Math.floor(diffInDays / 7);
                        scope.observation.value = `${gestationalAgeInWeeks} weeks`;
                        scope.observation.disabled = true; 
                        scope.$apply();
                    }
                });
                
                $rootScope.triageColorRed = 0;
                $rootScope.triageColorOrange = 0;
                $rootScope.triageColorYellow = 0;
                $rootScope.triageColorGreen = 0;
                $rootScope.isNoSignRed = false;
                $rootScope.isNoSignYellow = false

                // Function to update the triage colors above
                function updateTriageColorCounter(conceptName, hasValue) {
                    if (conceptName === "Pediatrics Triage Red" && !$rootScope.isNoSignRed) {
                        if (hasValue) {
                            $rootScope.triageColorRed++;
                        } else {
                            $rootScope.triageColorRed = 0;
                        }
                    } else if (conceptName === "Pediatrics Triage Orange") {
                        if (hasValue) {
                            $rootScope.triageColorOrange++;
                        } else {
                            $rootScope.triageColorOrange = 0;
                        }
                    } else if (conceptName === "Pediatrics Triage Yellow" && !$rootScope.isNoSignYellow) {
                        if (hasValue) {
                            $rootScope.triageColorYellow++;
                        } else {
                            $rootScope.triageColorYellow = 0;
                        }
                    } else if (conceptName === "Pediatrics Triage Green") {
                        if (hasValue) {
                            $rootScope.triageColorGreen++;
                        } else {
                            $rootScope.triageColorGreen = 0;
                        }
                    }
                }

                function calculateASOSScoreFromAll(rootObservation) {
                $rootScope.score2 = 0;

                function getDisplay(obs) {
                    return obs && obs._value && obs._value.name && obs._value.name.display ? obs._value.name.display : null;
                }

                if (!rootObservation || !rootObservation.groupMembers) return;

                rootObservation.groupMembers.forEach(function(observation) {
                    var display = getDisplay(observation);

                if (observation.concept && observation.concept.name == "ASOS, Age") {
                                if (display === "18-29") {
                                    $rootScope.score2 += 0;
                                } else if (display === "30-69") {
                                    $rootScope.score2 += 1;
                                } else if (display === "≥70") {
                                    $rootScope.score2 += 3;
                                }
                            }
                            if (observation.concept && observation.concept.name == "ASA") {
                                if (display === "ASA 1") {
                                    $rootScope.score2 += 0;
                                } else if (display === "ASA 2") {
                                    $rootScope.score2 += 2;
                                } else if (display === "ASA 3") {
                                    $rootScope.score2 += 5;
                                } else if (display && display.startsWith("ASA 4 and More")) {
                                    $rootScope.score2 += 8;
                                }
                            }
                            if (observation.concept && observation.concept.name == "Surgery timing") {
                                if (display === "Elective surgery") {
                                    $rootScope.score2 += 0;
                                } else if (display === "Urgent surgery") {
                                    $rootScope.score2 += 3;
                                } else if (display === "Emergent surgery") {
                                    $rootScope.score2 += 4;
                                }
                            }
                            if (observation.concept && observation.concept.name == "Surgery severity") {
                                if (display === "Minor") {
                                    $rootScope.score2 += 0;
                                } else if (display === "Intermediate") {
                                    $rootScope.score2 += 2;
                                } else if (display === "Major") {
                                    $rootScope.score2 += 4;
                                }
                            }
                            if (observation.concept && observation.concept.name == "Indication for surgery") {
                                if (display === "Non-communicable disease") {
                                    $rootScope.score2 += 0;
                                } else if (display === "indication of Surgery, Caesarean section") {
                                    $rootScope.score2 = $rootScope.score2 - 2;
                                } else if (display === "Trauma (set)") {
                                    $rootScope.score2 += 1;
                                } else if (display === "Infection present") {
                                    $rootScope.score2 += 2;
                                }
                            }
                            if (observation.concept && observation.concept.name == "Surgery type") {
                                if (display === "Gynecology/ Obstetrics") {
                                    $rootScope.score2 = $rootScope.score2 - 1;
                                } else if (display === "Plastics and breast") {
                                    $rootScope.score2 += 1;
                                } else if (display === "Urology") {
                                    $rootScope.score2 += 2;
                                } else if (display === "Ear, nose and throat, gastro-intestine, hepato-biliary, cardiothoracic, vascular") {
                                    $rootScope.score2 += 3;
                                } else if (display === "Neurosurgery") {
                                    $rootScope.score2 += 4;
                                } else if (display === "All other type of surgery") {
                                    $rootScope.score2 += 0;
                                }
                                    }
                            });

                            scope.$root.$broadcast("calculateStuff", { val: $rootScope.score2, str: "High Risk" });
                }
                $rootScope.total = 0;
                $rootScope.conceptValues = {};
                 observationsService.fetch(scope.patient.uuid, "ICU Urine output follow up sheet", "latest", 1, null, null, null, null).then(function (response) {
                        if(response.data.length!=0){
                            $rootScope.ICU= response.data[0];
                        }
                        if ($rootScope.ICU && Array.isArray($rootScope.ICU.groupMembers)) {
                            $rootScope.ICU.groupMembers.forEach(function (obs) {
                                if (obs.concept && obs.value !== null && obs.value !== undefined && obs.value !== "" && !isNaN(Number(obs.value))) {
                                    $rootScope.conceptValues[obs.concept.name] = Number(obs.value);
                                }
                            });
                        }
                });

                function calculateICUTotalOutputFromAll(rootObservation) {
                        var hourConcepts = [
                            "1st hr", "2nd hour", "3rd hour", "4th hour", "5th hour", "6th hour", "7th hour", "8th hour",
                            "9th hour", "10th hour", "11th hour", "12th hour", "13th hour", "14th hour", "15th hour", "16th hour",
                            "17th hour", "18th hour", "19th hour", "20th hour", "21th hour", "22th hour", "23th hour", "24th hour", "Total output"
                        ];
                    if (rootObservation.concept && hourConcepts.includes(rootObservation.concept.name)){
                    var conceptName = rootObservation.concept.name;
                    var newValue = parseInt(rootObservation.value);
                     if (isNaN(newValue) || rootObservation.value === null || rootObservation.value === "") {
                        // If the value is removed, subtract the previous value and remove the concept
                        if ($rootScope.conceptValues[conceptName] !== undefined) {
                            $rootScope.total -= $rootScope.conceptValues[conceptName];
                            delete $rootScope.conceptValues[conceptName];
                        }
                    } else {
                        if ($rootScope.conceptValues[conceptName] !== undefined) {
                            // Subtract the previous value
                            $rootScope.total -= $rootScope.conceptValues[conceptName];
                        }
                        $rootScope.total += newValue;
                        $rootScope.conceptValues[conceptName] = newValue;
                    }

                    if ($rootScope.ICU && Array.isArray($rootScope.ICU.groupMembers) && $rootScope.ICU.groupMembers.length > 0) {
                        recalculateICUTotalOutputFromGroupMembers($rootScope.ICU.groupMembers, $rootScope.total);
                    } else {
                        recalculateICUTotalOutputFromGroupMembers([], $rootScope.total);
                    }
                }
            }

                function recalculateICUTotalOutputFromGroupMembers(groupMembers, total = 0) {
                    if (!Array.isArray(groupMembers) || groupMembers.length === 0) {
                        scope.$root.$broadcast("calculateICUUrine", { val: total });
                        return;
                    }

                    var totalOutputObs = null;

                    for (var i = 0; i < groupMembers.length; i++) {
                        var obs = groupMembers[i];
                        if (!obs || !obs.concept) continue;

                        // Convert encounterDateTime to yyyy-mm-dd
                        var obsDate = obs.encounterDateTime || obs.observationDateTime;
                        if (!obsDate) continue;
                        var obsDateObj = new Date(obsDate);
                        var obsDateString = obsDateObj.getFullYear() + '-' +
                            String(obsDateObj.getMonth() + 1).padStart(2, '0') + '-' +
                            String(obsDateObj.getDate()).padStart(2, '0');

                        // Get today's date in yyyy-mm-dd
                        var todayObj = new Date();
                        var todayString = todayObj.getFullYear() + '-' +
                            String(todayObj.getMonth() + 1).padStart(2, '0') + '-' +
                            String(todayObj.getDate()).padStart(2, '0');

                        if (obs.concept.name === "Total output") {
                            totalOutputObs = obs;
                        } else if (
                            obs.value !== null &&
                            obs.value !== undefined &&
                            obs.value !== "" &&
                            !isNaN(Number(obs.value)) &&
                            obsDateString === todayString // Only add if date matches today
                        ) {
                            total += Number(obs.value);
                        }
                    }

                    if (totalOutputObs) {
                        totalOutputObs.value = total;
                    }
                    scope.$root.$broadcast("calculateICUUrine", { val: total });
                }

                var setEligibility = function (observation) {
                   if((observation.concept.name == "occupational risks" || observation.concept.name == "Marital Status/Sexual risks for HIV" || observation.concept.name == "clinical Sign of HIV/AIDS of Diagnosis") 
                        && scope.rootObservation.groupMembers.some(function (obs) { return obs.value == true }))
                        scope.$root.$broadcast("setEligibility", { val: true });
                   else if((observation.concept.name == "occupational risks" || observation.concept.name == "Marital Status/Sexual risks for HIV" || observation.concept.name == "clinical Sign of HIV/AIDS of Diagnosis")){
                        scope.$root.$broadcast("setEligibility", { val: false });
                        }
                   }
                   
                function calculateToxicologyTriageScore(rootObservation) {
                    $rootScope.triageToxiScore = 0;

                    if (!rootObservation || !rootObservation.groupMembers) return;
                    function getSelectedDisplays(obs) {
                        let results = [];

                        //If Multi-select enabled selectedObs
                        if (obs.selectedObs) {
                            results = Object.keys(obs.selectedObs);
                        }
                        //Boolean (Pain/Trauma)
                        else if (obs.value !== undefined && obs.value !== null) {
                            if (typeof obs.value === "boolean") {
                                results = [obs.value ? "Yes" : "No"];
                            } else if (obs.value.name && obs.value.name.display) {
                                results = [obs.value.name.display.trim()];
                            }
                        }
                        //The rest
                        else if (obs._value && obs._value.name && obs._value.name.display) {
                            results = [obs._value.name.display.trim()];
                        }

                        return results;
                    }

                    rootObservation.groupMembers.forEach(function(observation) {
                        let conceptName = observation.concept && observation.concept.name;
                        let selectedValues = getSelectedDisplays(observation);

                        selectedValues.forEach(function(display) {
                            display = display.trim();

                            if (conceptName === "Tox Response") {
                                if (display === "Alert.") $rootScope.triageToxiScore += 0;
                                else if (display === "To voice") $rootScope.triageToxiScore += 1;
                                else if (display === "To pain") $rootScope.triageToxiScore += 2;
                                else if (display === "UNRESPONSIVE") $rootScope.triageToxiScore += 3;
                            }

                            if (conceptName === "Tox Airway") {
                                if (display === "ayh, clear") $rootScope.triageToxiScore += 0;
                                else if (display === "Blocked") $rootScope.triageToxiScore += 3;
                            }

                            if (conceptName === "Tox Breathing") {
                                if (display === "SPO2>90") $rootScope.triageToxiScore += 3;
                                else if (display === "Yes/") $rootScope.triageToxiScore += 0;
                                else if (display === "No/") $rootScope.triageToxiScore += 3;
                            }

                            if (conceptName === "Tox RR") {
                                if (display === "<5") $rootScope.triageToxiScore += 3;
                                else if (display === "6-9") $rootScope.triageToxiScore += 2;
                                else if (display === "10-11") $rootScope.triageToxiScore += 1;
                                else if (display === "12-24") $rootScope.triageToxiScore += 0;
                                else if (display === "25-34") $rootScope.triageToxiScore += 1;
                                else if (display === "35-49") $rootScope.triageToxiScore += 2;
                                else if (display === ">50") $rootScope.triageToxiScore += 3;
                            }

                            if (conceptName === "Tox Heart rate") {
                                if (display === "<39") $rootScope.triageToxiScore += 3;
                                else if (display === "40- 54") $rootScope.triageToxiScore += 2;
                                else if (display === "55-69") $rootScope.triageToxiScore += 1;
                                else if (display === "70-109") $rootScope.triageToxiScore += 0;
                                else if (display === "110-139") $rootScope.triageToxiScore += 1;
                                else if (display === "140-179") $rootScope.triageToxiScore += 2;
                                else if (display === ">180") $rootScope.triageToxiScore += 3;
                            }

                            if (conceptName === "SBP") {
                                if (display === "<49") $rootScope.triageToxiScore += 3;
                                else if (display === "50-54") $rootScope.triageToxiScore += 2;
                                else if (display === "SBP 55-69") $rootScope.triageToxiScore += 1;
                                else if (display === "SBP 70-109") $rootScope.triageToxiScore += 0;
                                else if (display === "110-129") $rootScope.triageToxiScore += 1;
                                else if (display === "130-159") $rootScope.triageToxiScore += 2;
                                else if (display === ">160") $rootScope.triageToxiScore += 3;
                            }

                            if (conceptName === "Tox Temp") {
                                if (display === "OTP P RR <30") $rootScope.triageToxiScore += 3;
                                else if (display === "32-33") $rootScope.triageToxiScore += 2;
                                else if (display === "34-35") $rootScope.triageToxiScore += 1;
                                else if (display === "36-37") $rootScope.triageToxiScore += 0;
                                else if (display === "38-38.9") $rootScope.triageToxiScore += 1;
                                else if (display === "39-40") $rootScope.triageToxiScore += 2;
                                else if (display === ">41") $rootScope.triageToxiScore += 3;
                            }

                            if (conceptName === "Tox Pain") {
                                if (display === "No") $rootScope.triageToxiScore += 0;
                                else if (display === "Yes") $rootScope.triageToxiScore += 1;
                            }

                            if (conceptName === "Tox Trauma") {
                                if (display === "No") $rootScope.triageToxiScore += 0;
                                else if (display === "Yes") $rootScope.triageToxiScore += 1;
                            }
                        });
                    });``
                    let levelLabel = "";
                    if ($rootScope.triageToxiScore >= 7) {
                        levelLabel = "Red (To ICU)";
                    } else if ($rootScope.triageToxiScore >= 3 && $rootScope.triageToxiScore <= 6) {
                        levelLabel = "Yellow (To Recovery)";
                    } else {
                        levelLabel = "Green (To Recovery)";
                    }

                    scope.$root.$broadcast("calculateToxicology", { 
                        val: $rootScope.triageToxiScore + " (" + levelLabel + ")" 
                    });
                }

                function calculateNeuropathyScore(rootObservation) {
                    $rootScope.neuropathyScore = 0;

                    if (!rootObservation || !rootObservation.groupMembers) return;

                    function getSelectedDisplay(obs) {
                        if (obs.value && obs.value.name && obs.value.name.display) {
                            return obs.value.name.display.trim();
                        }
                        return null;
                    }

                    rootObservation.groupMembers.forEach(function (observation) {
                        let conceptName = observation.concept && observation.concept.name;
                        let display = getSelectedDisplay(observation);

                        if (!display) return;

                        
                        if (conceptName === "vibration nds" || conceptName === "Temperature Sensation" || conceptName === "Pinprick Sensation" || conceptName === "Achilles Reflex (reinforcement allowed)") {
                            if (display === "Normal") {
                                $rootScope.neuropathyScore += 0;
                            } else if (display === "Reduced") {
                                $rootScope.neuropathyScore += 1;
                            } else if (display === "Absent") {
                                $rootScope.neuropathyScore += 2;
                            }
                        }

                    });

                    
                    let interpretation = "";
                    if ($rootScope.neuropathyScore >= 7) {
                        interpretation = "Severe neuropathy";
                    } else if ($rootScope.neuropathyScore >= 4) {
                        interpretation = "Moderate neuropathy";
                    } else if ($rootScope.neuropathyScore >= 2) {
                        interpretation = "Mild neuropathy";
                    } else {
                        interpretation = "Normal";
                    }

                    
                    scope.$root.$broadcast("calculateNDSScore", {
                        val: $rootScope.neuropathyScore + " (" + interpretation + ")"
                    });
                }

                function calculateIWGDFScore(rootObservation) {

                    if (!rootObservation || !rootObservation.groupMembers) return;

                    
                    let hasLOPS = false;
                    let hasPAD = false;
                    let hasFootDeformity = false;
                    let hasPreviousUlcer = false;
                    let hasPreviousAmputation = false;
                    let hasCharcot = false;

                    function getYesNo(obs) {
                        if (obs.value) {
                            return obs.value;
                        }
                        return null;
                    }

                    rootObservation.groupMembers.forEach(function (observation) {
                        let conceptName = observation.concept && observation.concept.name;
                        let display = getYesNo(observation);

                        
                        if (!display) return;

                        if (conceptName === "Loss of protective sensation (LOPS):" && display === true) {
                            hasLOPS = true;
                        }

                        if (conceptName === "PAD//" && display === true) {
                            hasPAD = true;
                        }

                        if (conceptName === "Foot deformity," && display === true) {
                            hasFootDeformity = true;
                        }

                        if (conceptName === "Previous ulcer" && display === true) {
                            hasPreviousUlcer = true;
                        }

                        if (conceptName === "Previous amputation" && display === true) {
                            hasPreviousAmputation = true;
                        }

                        if (conceptName === "Charcot neuroarthropathy" && display === true) {
                            hasCharcot = true;
                        }
                    });

                    // IWGDF score decision logic
                    let score = 0;
                    let interpretation = "";

                    if (hasPreviousUlcer || hasPreviousAmputation || hasCharcot) {
                        score = 3;
                        interpretation = "Monthly / Specialist review";
                    } else if (hasPAD) {
                        score = 2;
                        interpretation = "Every 1–3 months";
                    } else if (hasLOPS) {
                        score = 1;
                        interpretation = "Every 3–6 months";
                    } else {
                        score = 0;
                        interpretation = "Annual";
                    }

                    $rootScope.IWGDFScore = score;

                    scope.$root.$broadcast("calculateIWGDFValue", {
                        val: score + " (" + interpretation + ")"
                    });
                }
    
                function calculateAldreteScore(rootObservation) {

                    if (!rootObservation || !rootObservation.groupMembers) return;

                    let totalScore = 0;

                    function getDisplay(obs) {
                        if (obs.value && obs.value.name && obs.value.name.display) {
                            return obs.value.name.display.trim();
                        }
                        return null;
                    }

                    rootObservation.groupMembers.forEach(function (observation) {
                        let conceptName = observation.concept && observation.concept.name;
                        let display = getDisplay(observation);

                        if (!display) return;


                                              
                        if (conceptName === "Activity PACU") {
                            if (display === "Move 4 extremities voluntarily or in command") totalScore += 2;
                            else if (display === "Move 2 extremities voluntarily or in command") totalScore += 1;
                            else if (display === "Move 1 extremities voluntarily or in command") totalScore += 0;
                        }

                        
                        if (conceptName === "Respiration PACU") {
                            if (display === "Able to breathe deeply or cough") totalScore += 2;
                            else if (display === "Dyspnea or limited breathing") totalScore += 1;
                            else if (display === "Apnea or mechanical ventilation") totalScore += 0;
                        }

                        
                        if (conceptName === "Circulatory PACU") {
                            if (display === "Systolic BP within 20mmHg from pre-anesthesia level") totalScore += 2;
                            else if (display === "Systolic BP within 20-50mmHg from pre-anesthesia level") totalScore += 1;
                            else if (display === "Systolic BP >50 or <50mmHg from pre-anesthesia level") totalScore += 0;
                        }

                        
                        if (conceptName === "Consciousness") {
                            if (display === "Fully awake") totalScore += 2;
                            else if (display === "Arousal of calling") totalScore += 1;
                            else if (display === "Unresponsive") totalScore += 0;
                        }

                        
                        if (conceptName === "Oxygen saturation(as compare to the baseline prior to surgery)") {
                            if (display === "Saturation > 92% on room air") totalScore += 2;
                            else if (display === "Need O2 to maintain oxygen saturation >92%") totalScore += 1;
                            else if (display === "Saturation less than 90% on oxygen") totalScore += 0;
                        }
                    });

                    $rootScope.aldrateScore = totalScore;

                    scope.$root.$broadcast("calculateAldreteValue", {
                        val: $rootScope.aldrateScore 
                    });
            }

                function calculateWaistInterpertation(rootObservation) {
                    if (!rootObservation || !rootObservation.groupMembers) return;

                    let waist = null;
                    let interpretation = "";

                    rootObservation.groupMembers.forEach(function (observation) {
                        let conceptName = observation.concept && observation.concept.name;

                        if (conceptName === "Waist circumference//") waist = observation.value;
                    });

                    if (!waist) return;

                    if (scope.patient.gender === "F") {
                        if (waist > 102) {
                            interpretation = "High Risk";
                        } else if (waist >= 94) {
                            interpretation = "Increased Risk";
                        } else {
                            interpretation = "Normal";
                        }
                    } else if (scope.patient.gender === "M") {
                        if (waist > 88) {
                            interpretation = "High Risk";
                        } else if (waist >= 80) {
                            interpretation = "Increased Risk";
                        } else {
                            interpretation = "Normal";
                        }
                    }

                    $rootScope.waistInterpretation = interpretation;

                    scope.$root.$broadcast("calculateWaistCircumference", {
                        val: waist + " cm (" + $rootScope.waistInterpretation + ")"
                    });
            }

            var setRiskCategory= function (observation) {

                if (observation.concept.name !== "Risk Score") return;

                var score = parseFloat(observation.value);

                if (isNaN(score)) {
                    scope.$root.$broadcast("setRiskCategory", { val: null });
                    return;
                }

                var category = null;

                if (score < 5) {
                    category = 0;
                } else if (score >= 5 && score < 10) {
                    category = 1;
                } else if (score >= 10 && score < 20) {
                    category = 2;
                } else if (score >= 20 && score < 30) {
                    category = 3;
                } else {
                    category = 4;
                }

                scope.$root.$broadcast("setRiskCategory", { val: category });
            }


            function calculateAbnormalVitals(rootObservation) {

                function isVitalAbnormal(observation) {
                    var name = observation.concept.name;
                    var value = Number(observation.value);

                    if (isNaN(value)) return false;

                    if (name === "MC PULSE RATE:") return value < 60 || value > 100;
                    if (name === "Tuberculosis, Pleural TB Respiratory Rate") return value < 16 || value > 20;
                    if (name === "Temperature Data") return value < 36.5 || value > 37.5;
                    if (name === "Systolic Data") return value < 90 || value > 120;
                    if (name === "Alert_Diastolic") return value < 60 || value > 80;
                    if (name === "SPO2 Data") return value < 90 || value > 100;

                    return false;
                }

                $rootScope.hasAbnormalVital = false;

                if (!rootObservation || !rootObservation.groupMembers) return;

                rootObservation.groupMembers.forEach(function (obs) {
                    if (isVitalAbnormal(obs)) {
                        $rootScope.hasAbnormalVital = true;
                    }
                });

                if ($rootScope.hasAbnormalVital) scope.$root.$broadcast("setVitalAbnormality", { val: true });
                else scope.$root.$broadcast("setVitalAbnormality", { val: false });
            }

            function hasTriageValue(value) {
                return value !== undefined && value !== null && value !== "";
            }

            function getTriageCodedValue(value) {
                if (!hasTriageValue(value)) return undefined;
                if (value.name && value.name.name) return value.name.name;
                if (value.name && value.name.display) return value.name.display;
                if (typeof value.name === "string") return value.name;
                return value.display || value;
            }

                scope.handleUpdate = function () {
                    calculateICUTotalOutputFromAll(scope.observation)
                    setEligibility(scope.observation);
                    calculateASOSScoreFromAll(scope.rootObservation)
                    calculateToxicologyTriageScore(scope.rootObservation)
                    calculateAldreteScore(scope.rootObservation)
                    if (scope.rootObservation.concept && scope.rootObservation.concept.name === "Vitals" 
                        || scope.rootObservation.concept.name === "Vital Sign follow up form" 
                        || scope.rootObservation.concept.name === "Early warning score chart" ) {
                        calculateAbnormalVitals(scope.rootObservation);
                    }
                    if (scope.rootObservation.concept && scope.rootObservation.concept.name === "Atherosclerotic Cardiovascular Disease (ASCVD)") setRiskCategory(scope.observation);
                    if (scope.rootObservation.concept && scope.rootObservation.concept.name === "Anthropometry//") calculateWaistInterpertation(scope.rootObservation);
                    if (scope.rootObservation.concept && scope.rootObservation.concept.name === "NDS Scoring") calculateNeuropathyScore(scope.rootObservation);
                    if (scope.rootObservation.concept && scope.rootObservation.concept.name === "D. IWGDF Risk Classification") calculateIWGDFScore(scope.rootObservation);

                    var isPediatricTriageForm = $rootScope.fromPediatric || scope?.conceptSetName == "Pediatrics Emergency Triage Form";
                    if (isPediatricTriageForm) {
                        var score = 0;
                        var triageColor = "Green";
                        
                        if (scope.observation && typeof scope.observation.hasValue === 'function') {
                            $rootScope.isNoSign = false;
                        if (scope.observation && scope.observation.selectedObs) {
                            Object.keys(scope.observation.selectedObs).forEach(key => {
                            if(key === 'No Sign'){
                                if(scope.observation.concept.name === "Pediatrics Triage Red"){

                                    $rootScope.isNoSignRed = true;
                                }
                                if(scope.observation.concept.name === "Pediatrics Triage Yellow"){

                                    $rootScope.isNoSignYellow = true;
                                }
                            }
                            });
                        }
                            updateTriageColorCounter(scope.observation.concept.name, scope.observation.hasValue());
                            $rootScope.isNoSignRed = false;
                            $rootScope.isNoSignYellow = false;
                        }

                        if ($rootScope.triageColorRed > 0) {
                            scope.$root[scope.observation.concept.name] = scope.observation.hasValue();
                            triageColor = "Red";
                            scope.$root.$broadcast("calculateStuff", { val: score, col: triageColor });
                        } else if ($rootScope.triageColorOrange > 0 && $rootScope.triageColorRed <= 0
                        ) {
                            scope.$root[scope.observation.concept.name] = scope.observation.hasValue();
                            triageColor = "Orange";
                            scope.$root.$broadcast("calculateStuff", { val: score, col: triageColor });
                        } else if ($rootScope.triageColorYellow > 0 && $rootScope.triageColorOrange <= 0 && $rootScope.triageColorRed <= 0
                        ) {
                            scope.$root[scope.observation.concept.name] = scope.observation.hasValue();
                            triageColor = "Yellow";
                            scope.$root.$broadcast("calculateStuff", { val: score, col: triageColor });
                        } else if ($rootScope.triageColorGreen > 0 && $rootScope.triageColorYellow <= 0 && $rootScope.triageColorOrange <= 0 && $rootScope.triageColorRed <= 0
                        ) {
                            scope.$root[scope.observation.concept.name] = scope.observation.hasValue();
                            triageColor = "Green";
                            scope.$root.$broadcast("calculateStuff", { val: score, col: triageColor });
                         } else if ($rootScope.triageColorGreen <= 0 && typeof scope.observation.hasValue === 'function') {
                            scope.$root[scope.observation.concept.name] = scope.observation.hasValue();
                            triageColor = "Green";
                            scope.$root.$broadcast("calculateStuff", { val: score, col: triageColor });
                        } else {
                             if(typeof scope.observation.hasValue === 'function'){
                                scope.$root[scope.observation.concept.name] = scope.observation.hasValue();
                                triageColor = "Green";
                                scope.$root.$broadcast("calculateStuff", { val: score, col: triageColor });
                            } 
                        }

                    }
                    if (scope.observation.concept.name == "Diabetes, Systolic Data" || scope.observation.concept.name == "Systolic Data" ||
                        scope.observation.concept.name == "RR Data" || scope.observation.concept.name == "Temperature Data" ||
                        scope.observation.concept.name == "Triage Mobility" || scope.observation.concept.name == "Triage AVPU" || scope.observation.concept.name == "Triage Trauma" ||
                        scope.observation.concept.name == "Pulse Data" || scope.observation.concept.name == "WEIGHT" || scope.observation.concept.name == "HEIGHT"
                    ) {
                        scope.$root[scope.observation.concept.name] = scope.observation.value
                    }
                    if (scope.observation.concept.name == "Triage Red" || scope.observation.concept.name == "Triage Orange" || scope.observation.concept.name == "Triage Yellow" ||
                        scope.observation.concept.name == "Triage Green" || scope.observation.concept.name == "Triage Black") {
                        scope.$root[scope.observation.concept.name] = scope.observation.hasValue()
                    }

                    if (scope.$root["WEIGHT"] && scope.$root["HEIGHT"] && scope.$root["HEIGHT"] > 0) {
                        var height = scope.$root["HEIGHT"] / 100
                        var bmi_score = (scope.$root["WEIGHT"] / (height * height)).toFixed(2);
                        var today = new Date();
                        var birthDate = new Date(scope.patient.birthdate);
                        var age = today.getFullYear() - birthDate.getFullYear();
                        var m = today.getMonth() - birthDate.getMonth();
                        age = age * 12 + m;
                        var bmi_status_fetcher = "BMI-STATUS:" + scope.patient.gender + age
                        var bmi_scale = []
                        var bmi_status_final = ""
                        if (age > 228) {
                            if (bmi_score < 16) bmi_status_final = "VERY SEVERELY UNDERWEIGHT"
                            else if (bmi_score < 17) bmi_status_final = "SEVERELY UNDERWEIGHT"
                            else if (bmi_score < 18.5) bmi_status_final = "UNDERWEIGHT"
                            else if (bmi_score < 25) bmi_status_final = "NORMAL"
                            else if (bmi_score < 30) bmi_status_final = "OVERWEIGHT"
                            else if (bmi_score < 35) bmi_status_final = "OBESE"
                            else if (bmi_score < 40) bmi_status_final = "SEVERELY OBESE"
                            else bmi_status_final = "VERY SEVERELY OBESE"
                        }
                        else {
                            var params = {
                                q: "get_bmi_status",
                                v: "full",
                                concept: bmi_status_fetcher
                            };


                            $http.get(Bahmni.Common.Constants.sqlUrl, {
                                method: "GET",
                                params: params,
                                withCredentials: true
                            }).then(function (result) {
                                if (result.data.length > 0) {
                                    bmi_scale = result.data[0].split(',')
                                    parseFloat(bmi_scale[0])
                                    if (bmi_score < parseFloat(bmi_scale[0])) bmi_status_final = "UNDERWEIGHT"
                                    else if (bmi_score < parseFloat(bmi_scale[1])) bmi_status_final = "NORMAL"
                                    else if (bmi_score < parseFloat(bmi_scale[2])) bmi_status_final = "OVERWEIGHT"
                                    else if (bmi_score < parseFloat(bmi_scale[3])) bmi_status_final = "OBESE"
                                    else bmi_status_final = "SEVERELY OBESE"
                                }

                            })
                        }
                        scope.$root.$broadcast("calculateBMI", { score: bmi_score, status: bmi_status_final });
                    }
                    var systolic = hasTriageValue(scope.$root["Diabetes, Systolic Data"])
                        ? scope.$root["Diabetes, Systolic Data"]
                        : scope.$root["Systolic Data"];
                    var rr = scope.$root["RR Data"];
                    var temperature = scope.$root["Temperature Data"];
                    var mobility = getTriageCodedValue(scope.$root["Triage Mobility"]);
                    var avpu = getTriageCodedValue(scope.$root["Triage AVPU"]);
                    var trauma = scope.$root["Triage Trauma"];
                    var pulse = scope.$root["Pulse Data"];
                    var hasAnyAdultTriageInput = [
                        systolic, rr, temperature, mobility, avpu, trauma, pulse,
                        scope.$root["Triage Red"], scope.$root["Triage Orange"],
                        scope.$root["Triage Yellow"], scope.$root["Triage Green"],
                        scope.$root["Triage Black"]
                    ].some(hasTriageValue);

                    if (!isPediatricTriageForm && hasAnyAdultTriageInput) {
                        var score = 0;
                        var triageColor = "";

                        if (hasTriageValue(systolic)) {
                            if (101 <= systolic && systolic <= 199)
                                score = score + 0
                            else if (81 <= systolic && systolic <= 100)
                                score = score + 1
                            else if ((71 <= systolic && systolic <= 80) || systolic > 199)
                                score = score + 2
                            else if (systolic < 71)
                                score = score + 3
                        }

                        if (hasTriageValue(rr)) {
                            if (12 <= rr && rr <= 20)
                                score = score + 0
                            else if (21 <= rr && rr <= 28)
                                score = score + 1
                            else if (29 <= rr && rr <= 39)
                                score = score + 2
                            else if (rr >= 40 || rr < 12)
                                score = score + 3
                        }

                        if (hasTriageValue(temperature)) {
                            if (35 <= temperature && temperature <= 38.4)
                                score = score + 0
                            else if (temperature < 35 || temperature > 38.4)
                                score = score + 2
                        }

                        if (hasTriageValue(pulse)) {
                            if (51 <= pulse && pulse <= 100)
                                score = score + 0
                            else if ((41 <= pulse && pulse <= 50) || (101 <= pulse && pulse <= 110))
                                score = score + 1
                            else if (pulse < 41 || (111 <= pulse && pulse <= 129))
                                score = score + 2
                            else if (pulse > 129)
                                score = score + 3
                        }

                        if (hasTriageValue(mobility)) {
                            if (mobility == "Triage walking")
                                score = score + 0
                            else if (mobility == "Triage With help")
                                score = score + 1
                            else if (mobility == "Triage Stretcher/ Immobile")
                                score = score + 2
                        }

                        if (hasTriageValue(avpu)) {
                            if (avpu == "Alert")
                                score = score + 0
                            else if (avpu == "Triage Reacts to Voice")
                                score = score + 1
                            else if (avpu == "Triage Reacts to pain")
                                score = score + 2
                            else if (avpu == "UNRESPONSIVE")
                                score = score + 3
                        }

                        if (hasTriageValue(trauma) && trauma == true)
                            score = score + 1

                        if (scope.$root["Triage Red"])
                            triageColor = "RED"
                        else if (scope.$root["Triage Orange"]) {
                            if (score >= 7)
                                triageColor = "RED"
                            else
                                triageColor = "ORANGE"
                        } else if (scope.$root["Triage Yellow"]) {
                            if (score >= 7)
                                triageColor = "RED"
                            else if (5 <= score && score <= 6)
                                triageColor = "ORANGE"
                            else
                                triageColor = "YELLOW"
                        } else {
                            if (score >= 7)
                                triageColor = "RED"
                            else if (5 <= score && score <= 6)
                                triageColor = "ORANGE"
                            else if (3 <= score && score <= 4)
                                triageColor = "YELLOW"
                            else
                                triageColor = "GREEN"
                        }

                        if (scope.$root["Triage Black"])
                            triageColor = "BLACK"

                        scope.$root.$broadcast("calculateStuff", { val: score, col: triageColor });
                    }

                    if (scope.rootObservation.concept.name == "Early warning score chart")
                       scope.$parent.setWarningScore(scope.observation)

                    scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                };



                scope.update = function (value) {
                    if (scope.getBooleanResult(scope.observation.isObservationNode)) {
                        scope.observation.primaryObs.value = value;
                    } else if (scope.getBooleanResult(scope.observation.isFormElement())) {
                        scope.observation.value = value;
                    }
                    scope.handleUpdate();
                };

                scope.getBooleanResult = function (value) {
                    return !!value;
                };
                scope.translatedLabel = function (observation) {
                    if (observation && observation.concept) {
                        var currentLocale = $rootScope.currentUser.userProperties.defaultLocale;
                        var conceptNames = observation.concept.names ? observation.concept.names : [];
                        var shortName = conceptNames.find(function (cn) {
                            return cn.locale === currentLocale && cn.conceptNameType === "SHORT";
                        });

                        if (shortName) {
                            return shortName.name;
                        }

                        var fsName = conceptNames.find(function (cn) {
                            return cn.locale === currentLocale && cn.conceptNameType === "FULLY_SPECIFIED";
                        });

                        if (fsName) {
                            return fsName.name;
                        }

                        return observation.concept.shortName || observation.concept.name;
                    }
                    if (observation) {
                        return observation.label;
                    }
                    return "UNKNOWN_OBSERVATION_CONCEPT";
                };
            };

            var compile = function (element) {
                return RecursionHelper.compile(element, link);
            };

            return {
                restrict: 'E',
                compile: compile,
                scope: {
                    conceptSetName: "=",
                    observation: "=",
                    atLeastOneValueIsSet: "=",
                    showTitle: "=",
                    conceptSetRequired: "=",
                    rootObservation: "=",
                    patient: "=",
                    collapseInnerSections: "=",
                    rootConcept: "&",
                    hideAbnormalButton: "="
                },
                templateUrl: '../common/concept-set/views/observation.html'
            };
        }]);
