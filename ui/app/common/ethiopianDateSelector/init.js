var Bahmni = Bahmni || {};
Bahmni.Common = Bahmni.Common || {};
Bahmni.Common.EthiopianDateSelector = Bahmni.Common.EthiopianDateSelector || {};

angular.module('bahmni.common.ethiopianDateSelector', []);

Bahmni.Common.EthiopianDateSelector.constants = {
    holidays: {
        holidayClass: "holiday",
        2011: {
            1: {
                1: {
                    title: "ቅዱስ ዩሐንስ (Ethiopian New Year)",
                    confirmed: true
                },
                17: {
                    title: "መስቀል (Finding of the True Cross)",
                    confirmed: true
                }
            },
            3: {
                11: {
                    title: "መዉሊድ (Birth of Prophet Mohammed)",
                    confirmed: false
                }
            },
            4: {
                29: {
                    title: "ልደት (Ethiopian Christmas)",
                    confirmed: true
                }
            },
            5: {
                11: {
                    title: "ጥምቀት (Epiphany)",
                    confirmed: true
                }
            },
            6: {
                23: {
                    title: "የአድዋ ድል መታስቢያ (Adwa Victory Day)",
                    confirmed: true
                }
            },
            8: {
                18: {
                    title: "ስቅለት (Good Friday)",
                    confirmed: true
                },
                20: {
                    title: "ትንሳዔ (Easter)",
                    confirmed: true
                },
                23: {
                    title: "የወዛድሮች ቀን (Labour Day)",
                    confirmed: true
                },
                27: {
                    title: "የአርበኞች ቀን (Ethiopian Patriots Day)",
                    confirmed: true
                }
            },
            9: {
                27: {
                    title: " ኢድ አል ፈጥር (ረመዳን) (Eid al-Fitr)",
                    confirmed: false
                },
                20: {
                    title: "ደርግ የወደቀበት ቀን (Derg Downfall Day)",
                    confirmed: true
                }
            },
            12: {
                5: {
                    title: "አረፋ (Eid al-Adha)",
                    confirmed: false
                }
            }
        },
        2012: {
            1: {
                1: {
                    title: "ቅዱስ ዩሐንስ (Ethiopian New Year)",
                    confirmed: true
                },
                17: {
                    title: "መስቀል (Finding of the True Cross)",
                    confirmed: true
                }
            },
            2: {
                29: {
                    title: "መዉሊድ (Birth of Prophet Mohammed)",
                    confirmed: false
                }
            },
            4: {
                28: {
                    title: "ልደት (Ethiopian Christmas)",
                    confirmed: true
                }
            },
            5: {
                11: {
                    title: "ጥምቀት (Epiphany)",
                    confirmed: true
                }
            },
            6: {
                23: {
                    title: "የአድዋ ድል መታስቢያ (Adwa Victory Day)",
                    confirmed: true
                }
            },
            8: {
                9: {
                    title: "ስቅለት (Good Friday)",
                    confirmed: true
                },
                11: {
                    title: "ትንሳዔ (Easter)",
                    confirmed: true
                },
                23: {
                    title: "የወዛድሮች ቀን (Labour Day)",
                    confirmed: true
                },
                27: {
                    title: "የአርበኞች ቀን (Ethiopian Patriots Day)",
                    confirmed: true
                }
            },
            9: {
                16: {
                    title: " ኢድ አል ፈጥር (ረመዳን) (Eid al-Fitr)",
                    confirmed: false
                },
                20: {
                    title: "ደርግ የወደቀበት ቀን (Derg Downfall Day)",
                    confirmed: true
                }
            },
            11: {
                24: {
                    title: "አረፋ (Eid al-Adha)",
                    confirmed: false
                }
            }
        },
        2013: {
            1: {
                1: {
                    title: "ቅዱስ ዩሐንስ (Ethiopian New Year)",
                    confirmed: true
                },
                17: {
                    title: "መስቀል (Finding of the True Cross)",
                    confirmed: true
                }
            },
            2: {
                19: {
                    title: "መዉሊድ (Birth of Prophet Mohammed)",
                    confirmed: false
                }
            },
            4: {
                29: {
                    title: "ልደት (Ethiopian Christmas)",
                    confirmed: true
                }
            },
            5: {
                11: {
                    title: "ጥምቀት (Epiphany)",
                    confirmed: true
                }
            },
            6: {
                23: {
                    title: "የአድዋ ድል መታስቢያ (Adwa Victory Day)",
                    confirmed: true
                }
            },
            8: {
                22: {
                    title: "ስቅለት (Good Friday)",
                    confirmed: true
                },
                24: {
                    title: "ትንሳዔ (Easter)",
                    confirmed: true
                },
                23: {
                    title: "የወዛድሮች ቀን (Labour Day)",
                    confirmed: true
                },
                27: {
                    title: "የአርበኞች ቀን (Ethiopian Patriots Day)",
                    confirmed: true
                }
            },
            9: {
                5: {
                    title: " ኢድ አል ፈጥር (ረመዳን) (Eid al-Fitr)",
                    confirmed: false
                },
                20: {
                    title: "ደርግ የወደቀበት ቀን (Derg Downfall Day)",
                    confirmed: true
                }
            },
            11: {
                13: {
                    title: "አረፋ (Eid al-Adha)",
                    confirmed: false
                }
            }
        },
        2014: {
            1: {
                1: {
                    title: "ቅዱስ ዩሐንስ (Ethiopian New Year)",
                    confirmed: true
                },
                17: {
                    title: "መስቀል (Finding of the True Cross)",
                    confirmed: true
                }
            },
            2: {
                8: {
                    title: "መዉሊድ (Birth of Prophet Mohammed)",
                    confirmed: false
                }
            },
            4: {
                29: {
                    title: "ልደት (Ethiopian Christmas)",
                    confirmed: true
                }
            },
            5: {
                11: {
                    title: "ጥምቀት (Epiphany)",
                    confirmed: true
                }
            },
            6: {
                23: {
                    title: "የአድዋ ድል መታስቢያ (Adwa Victory Day)",
                    confirmed: true
                }
            },
            8: {
                14: {
                    title: "ስቅለት (Good Friday)",
                    confirmed: true
                },
                16: {
                    title: "ትንሳዔ (Easter)",
                    confirmed: true
                },
                23: {
                    title: "የወዛድሮች ቀን (Labour Day)",
                    confirmed: true
                },
                24: {
                    title: " ኢድ አል ፈጥር (ረመዳን) (Eid al-Fitr)",
                    confirmed: false
                },
                27: {
                    title: "የአርበኞች ቀን (Ethiopian Patriots Day)",
                    confirmed: true
                }
            },
            9: {
                20: {
                    title: "ደርግ የወደቀበት ቀን (Derg Downfall Day)",
                    confirmed: true
                }
            },
            11: {
                2: {
                    title: "አረፋ (Eid al-Adha)",
                    confirmed: false
                }
            }
        },
        2015: {
            1: {
                1: {
                    title: "ቅዱስ ዩሐንስ (Ethiopian New Year)",
                    confirmed: true
                },
                17: {
                    title: "መስቀል (Finding of the True Cross)",
                    confirmed: true
                },
                28: {
                    title: "መዉሊድ (Birth of Prophet Mohammed)",
                    confirmed: false
                }
            },
            4: {
                29: {
                    title: "ልደት (Ethiopian Christmas)",
                    confirmed: true
                }
            },
            5: {
                11: {
                    title: "ጥምቀት (Epiphany)",
                    confirmed: true
                }
            },
            6: {
                23: {
                    title: "የአድዋ ድል መታስቢያ (Adwa Victory Day)",
                    confirmed: true
                }
            },
            8: {
                6: {
                    title: "ስቅለት (Good Friday)",
                    confirmed: true
                },
                8: {
                    title: "ትንሳዔ (Easter)",
                    confirmed: true
                },
                23: {
                    title: "የወዛድሮች ቀን (Labour Day)",
                    confirmed: true
                },
                13: {
                    title: " ኢድ አል ፈጥር (ረመዳን) (Eid al-Fitr)",
                    confirmed: false
                },
                27: {
                    title: "የአርበኞች ቀን (Ethiopian Patriots Day)",
                    confirmed: true
                }
            },
            9: {
                20: {
                    title: "ደርግ የወደቀበት ቀን (Derg Downfall Day)",
                    confirmed: true
                }
            },
            10: {
                21: {
                    title: "አረፋ (Eid al-Adha)",
                    confirmed: false
                }
            }
        }
    }
};
