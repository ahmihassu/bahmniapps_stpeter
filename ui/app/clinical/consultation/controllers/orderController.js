'use strict';

angular.module('bahmni.clinical')
    .controller('OrderController', ['$http','$scope', '$rootScope' ,'allOrderables', 'ngDialog', 'retrospectiveEntryService', 'appService', '$translate',
        function ($http,$scope, $rootScope , allOrderables, ngDialog, retrospectiveEntryService, appService, $translate) {
            $scope.consultation.orders = $scope.consultation.orders || [];
            $scope.consultation.childOrders = $scope.consultation.childOrders || [];
            $scope.allOrdersTemplates = allOrderables;
            var RadiologyOrderOptionsConfig = appService.getAppDescriptor().getConfig("enableRadiologyOrderOptions");
            var LabOrderOptionsConfig = appService.getAppDescriptor().getConfig("enableLabOrderOptions");
            $scope.enableRadiologyOrderOptions = RadiologyOrderOptionsConfig ? RadiologyOrderOptionsConfig.value : null;
            $scope.enableLabOrderOptions = LabOrderOptionsConfig ? LabOrderOptionsConfig.value : null;
            var testConceptToParentsMapping = {}; // A child concept could be part of multiple parent panels
            
                       var collapseExistingActiveSection = function (section) {
                if (section) {
                    section.klass = "";
                }
            };

            var showFirstLeftCategoryByDefault = function () {
                if (!$scope.activeTab.leftCategory) {
                    var allLeftCategories = $scope.getOrderTemplate($scope.activeTab.name).setMembers;
                    if (allLeftCategories.length > 0) {
                        $scope.showLeftCategoryTests(allLeftCategories[0]);
                    }
                }
            };

            var findTest = function (testUuid) {
                var test;
                var allLeftCategories = $scope.getOrderTemplate($scope.activeTab.name).setMembers;
                _.each(allLeftCategories, function (leftCategory) {
                    var foundTest = _.find(leftCategory.setMembers, function (test) {
                        return test.uuid === testUuid;
                    });
                    if (foundTest) {
                        test = foundTest;
                        return;
                    }
                });
                return test;
            };

            var removeOrder = function (testUuid) {
                var order = _.find($scope.consultation.orders, function (order) {
                    return order.concept.uuid === testUuid;
                });
                if (order) {
                    if (order.uuid) {
                        order.isDiscontinued = true;
                    } else {
                        _.remove($scope.consultation.orders, order);
                    }
                }
            };

            var createOrder = function (test) {
                var discontinuedOrder = _.find($scope.consultation.orders, function (order) {
                    return (test.uuid === order.concept.uuid) && order.isDiscontinued;
                });
                if (discontinuedOrder) {
                    discontinuedOrder.isDiscontinued = false;
                } else {
                    var createdOrder = Bahmni.Clinical.Order.create(test);
                    $scope.consultation.orders.push(createdOrder);
                }
            };

            var initTestConceptToParentsMapping = function () {
                var allLeftCategories = $scope.getOrderTemplate($scope.activeTab.name).setMembers;
                _.each(allLeftCategories, function (leftCategory) {
                    _.each(leftCategory.setMembers, function (member) {
                        if (member.setMembers.length !== 0) {
                            _.each(member.setMembers, function (child) {
                                if (testConceptToParentsMapping[child.uuid] === undefined) {
                                    testConceptToParentsMapping[child.uuid] = [];
                                }
                                testConceptToParentsMapping[child.uuid].push(member.uuid);
                            });
                        }
                    });
                });
            };

            var init = function () {
                $scope.orderPhoneNumber = '';
                $scope.loadUserPhoneNumber();
                $scope.tabs = [];
                _.forEach($scope.allOrdersTemplates, function (item) {
                    var conceptName = $scope.getName(item);
                    $scope.tabs.push({name: conceptName ? conceptName : item.name.name, topLevelConcept: item.name.name});
                });
                if ($scope.tabs) {
                    $scope.activateTab($scope.tabs[0]);
                    initTestConceptToParentsMapping();
                }
            };

            $scope.isRetrospectiveMode = function () {
                return !_.isEmpty(retrospectiveEntryService.getRetrospectiveEntry());
            };

            $scope.activateTab = function (tab) {
                if (tab.klass === "active") {
                    tab.klass = "";
                    $scope.activeTab = undefined;
                } else {
                    collapseExistingActiveSection($scope.activeTab);
                    $scope.activeTab = tab;
                    $scope.activeTab.klass = "active";
                    $scope.updateSelectedOrdersForActiveTab();
                    initTestConceptToParentsMapping();
                    showFirstLeftCategoryByDefault();
                }
            };

            $scope.updateSelectedOrdersForActiveTab = function () {
                if (!$scope.activeTab) {
                    return;
                }
                var activeTabTestConcepts = _.map(_.flatten(_.map($scope.getOrderTemplate($scope.activeTab.name).setMembers, 'setMembers')), 'uuid');
                $scope.selectedOrders = _.filter($scope.consultation.orders, function (testOrder) {
                    return _.indexOf(activeTabTestConcepts, testOrder.concept.uuid) !== -1;
                });

                _.each($scope.selectedOrders, function (order) {
                    order.isUrgent = order.urgency == "STAT" ? true : order.isUrgent;
                });
            };

            $scope.getOrderTemplate = function (templateName) {
                var key = '\'' + templateName + '\'';
                return $scope.allOrdersTemplates[key];
            };

            $scope.showLeftCategoryTests = function (leftCategory) {
                collapseExistingActiveSection($scope.activeTab.leftCategory);
                $scope.activeTab.leftCategory = leftCategory;
                $scope.activeTab.leftCategory.klass = "active";

                $scope.activeTab.leftCategory.groups = $scope.getConceptClassesInSet(leftCategory);
            };

            $scope.getConceptClassesInSet = function (conceptSet) {
                var conceptsWithUniqueClass = _.uniqBy(conceptSet ? conceptSet.setMembers : [], function (concept) { return concept.conceptClass.uuid; });
                var conceptClasses = [];
                _.forEach(conceptsWithUniqueClass, function (concept) {
                    conceptClasses.push({name: concept.conceptClass.name, description: concept.conceptClass.description});
                });
                conceptClasses = _.sortBy(conceptClasses, 'name');
                return conceptClasses;
            };

            $scope.$watchCollection('consultation.orders', $scope.updateSelectedOrdersForActiveTab);

            var getUserPhoneNumber = function () {
                var params = {
                    q: "bahmni.sqlGet.providerNumber",
                    personUuid: $rootScope.currentUser.person.uuid
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            $scope.loadUserPhoneNumber = function () {
                return getUserPhoneNumber()
                    .then(function (response) {
                        var phone = response?.data[0]?.phoneNumber ||  '';
                        $scope.consultation.orderPhoneNumber = (phone || '').toString().trim();
                        return $scope.consultation.orderPhoneNumber;
                    })
                    .catch(function (error) {
                        $scope.consultation.orderPhoneNumber = '';
                        return null;
                    });
            };

            
            $scope.ensurePhoneInComment = function(order) {
                if ($scope.consultation?.orderPhoneNumber) {
                    appendPhone(order, $scope.consultation.orderPhoneNumber);
                    return;
                }

                $scope.loadUserPhoneNumber().then(function (phone) {
                    if (phone) {
                        appendPhone(order, phone);
                    }
                });
            };
            
            $scope.handleOrderClick = function (order) {
                if(order.orderType === "Lab Order")
                    enusurePhoneInComment(order);
                var test = findTest(order.concept.uuid);
                $scope.toggleOrderSelection(test);
            };

            $scope.search = {};
            $scope.search.string = '';
            $scope.resetSearchString = function () {
                $scope.search.string = '';
            };

            $scope.toggleOrderSelection = function (test) {
                $scope.resetSearchString();
                var orderPresent = $scope.isActiveOrderPresent(test);
                if (!orderPresent) {
                    createOrder(test);
                    // Find the newly created order
                    var newOrder = _.find($scope.consultation.orders, function(order) {
                        return order.concept.uuid === test.uuid && !order.isDiscontinued;
                    });
                    // Ensure phone in comment for Lab Order
                    if (newOrder && newOrder.orderType === "Lab Order") {
                        $scope.ensurePhoneInComment(newOrder);
                    }
                    _.each(test.setMembers, function (child) {
                        removeOrder(child.uuid);
                    });
                } else {
                    removeOrder(test.uuid);
                }
            };

            $scope.isActiveOrderPresent = function (test) {
                var validOrders = _.filter($scope.consultation.orders, function (testOrder) {
                    return !testOrder.isDiscontinued;
                });
                return _.find(validOrders, function (order) {
                    return (order.concept.uuid === test.uuid) || _.includes(testConceptToParentsMapping[test.uuid], order.concept.uuid);
                });
            };

            $scope.checkAvailable = function (test) {
                var result = true
                test.mappings.forEach(mapping => {
                    if(mapping.display.includes("Availability")) result = false
                });
                return result
            }

            $scope.isOrderNotEditable = function (order) {
                var test = findTest(order.concept.uuid);
                return $scope.isTestIndirectlyPresent(test);
            };

            $scope.isTestIndirectlyPresent = function (test) {
                var validOrders = _.filter($scope.consultation.orders, function (testOrder) {
                    return !testOrder.isDiscontinued;
                });
                return _.find(validOrders, function (order) {
                    return _.includes(testConceptToParentsMapping[test.uuid], order.concept.uuid);
                });
            };

            $scope.openNotesPopup = function (order) {
                order.previousNote = order.commentToFulfiller;
                $scope.orderNoteText = order.previousNote;
                $scope.dialog = ngDialog.open({ template: 'consultation/views/orderNotes.html', className: 'selectedOrderNoteContainer-dialog ngdialog-theme-default', data: order, scope: $scope
                });
            };

            $scope.$on('ngDialog.opened', function () {
                $('body').addClass('show-controller-back');
            });

            $scope.$on('ngDialog.closed', function () {
                $('body').removeClass('show-controller-back');
            });

            $scope.appendPrintNotes = function (order) {
                var printNotes = $translate.instant("CLINICAL_ORDER_RADIOLOGY_NEED_PRINT");
                if (order.previousNote && order.previousNote.indexOf(printNotes) == -1) {
                    $scope.orderNoteText = printNotes + (order.previousNote || '');
                } else if (($scope.orderNoteText || '').indexOf(printNotes) == -1) {
                    $scope.orderNoteText = $translate.instant(printNotes) + ($scope.orderNoteText || '');
                }
            };

            $scope.isPrintShown = function (isOrderSaved) {
                var configuredOptions = getConfiguredOptions();
                return _.some(configuredOptions, function (option) {
                    return option.toLowerCase() === 'needsprint';
                })
                && !isOrderSaved;
            };
            $scope.isUrgent = function () {
                var configuredOptions = getConfiguredOptions();
                return _.some(configuredOptions, function (option) {
                    return option.toLowerCase() === 'urgent';
                });
            };
            var getConfiguredOptions = function () {
                var configuredOptions = null;
                if ($scope.activeTab.name == 'Radiology') {
                    configuredOptions = $scope.enableRadiologyOrderOptions;
                } else {
                    configuredOptions = $scope.enableLabOrderOptions;
                }
                return configuredOptions;
            };
            
            $scope.setEditedFlag = function (order, orderNoteText) {
                if (order.previousNote !== orderNoteText) {
                    order.commentToFulfiller = orderNoteText;
                    order.hasBeenModified = true;
                }
                $scope.closePopup();
            };

            $scope.closePopup = function () {
                ngDialog.close();
            };

            $scope.getName = function (sample) {
                var name = _.find(sample.names, {conceptNameType: "SHORT"}) || _.find(sample.names, {conceptNameType: "FULLY_SPECIFIED"});
                return name && name.name;
            };

            init();
        }]);
