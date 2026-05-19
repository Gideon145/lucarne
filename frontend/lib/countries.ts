export interface Country {
  iso3:          string;
  iso2:          string;
  name:          string;
  flag:          string;
  confederation: string;
}

export const COUNTRIES: Country[] = [
  // CONMEBOL
  { iso3: "ARG", iso2: "ar",     name: "Argentina",            flag: "🇦🇷", confederation: "CONMEBOL" },
  { iso3: "BRA", iso2: "br",     name: "Brazil",               flag: "🇧🇷", confederation: "CONMEBOL" },
  { iso3: "URU", iso2: "uy",     name: "Uruguay",              flag: "🇺🇾", confederation: "CONMEBOL" },
  { iso3: "COL", iso2: "co",     name: "Colombia",             flag: "🇨🇴", confederation: "CONMEBOL" },
  { iso3: "ECU", iso2: "ec",     name: "Ecuador",              flag: "🇪🇨", confederation: "CONMEBOL" },
  { iso3: "PAR", iso2: "py",     name: "Paraguay",             flag: "🇵🇾", confederation: "CONMEBOL" },
  // UEFA
  { iso3: "FRA", iso2: "fr",     name: "France",               flag: "🇫🇷", confederation: "UEFA"     },
  { iso3: "ENG", iso2: "gb-eng", name: "England",              flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA"     },
  { iso3: "ESP", iso2: "es",     name: "Spain",                flag: "🇪🇸", confederation: "UEFA"     },
  { iso3: "GER", iso2: "de",     name: "Germany",              flag: "🇩🇪", confederation: "UEFA"     },
  { iso3: "POR", iso2: "pt",     name: "Portugal",             flag: "🇵🇹", confederation: "UEFA"     },
  { iso3: "NED", iso2: "nl",     name: "Netherlands",          flag: "🇳🇱", confederation: "UEFA"     },
  { iso3: "BEL", iso2: "be",     name: "Belgium",              flag: "🇧🇪", confederation: "UEFA"     },
  { iso3: "CRO", iso2: "hr",     name: "Croatia",              flag: "🇭🇷", confederation: "UEFA"     },
  { iso3: "CHE", iso2: "ch",     name: "Switzerland",          flag: "🇨🇭", confederation: "UEFA"     },
  { iso3: "NOR", iso2: "no",     name: "Norway",               flag: "🇳🇴", confederation: "UEFA"     },
  { iso3: "AUT", iso2: "at",     name: "Austria",              flag: "🇦🇹", confederation: "UEFA"     },
  { iso3: "SWE", iso2: "se",     name: "Sweden",               flag: "🇸🇪", confederation: "UEFA"     },
  { iso3: "SCO", iso2: "gb-sct", name: "Scotland",             flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", confederation: "UEFA"     },
  { iso3: "CZE", iso2: "cz",     name: "Czechia",              flag: "🇨🇿", confederation: "UEFA"     },
  { iso3: "BIH", iso2: "ba",     name: "Bosnia-Herzegovina",   flag: "🇧🇦", confederation: "UEFA"     },
  { iso3: "TUR", iso2: "tr",     name: "Türkiye",              flag: "🇹🇷", confederation: "UEFA"     },
  // CONCACAF
  { iso3: "USA", iso2: "us",     name: "USA",                  flag: "🇺🇸", confederation: "CONCACAF" },
  { iso3: "MEX", iso2: "mx",     name: "Mexico",               flag: "🇲🇽", confederation: "CONCACAF" },
  { iso3: "CAN", iso2: "ca",     name: "Canada",               flag: "🇨🇦", confederation: "CONCACAF" },
  { iso3: "PAN", iso2: "pa",     name: "Panama",               flag: "🇵🇦", confederation: "CONCACAF" },
  { iso3: "HAI", iso2: "ht",     name: "Haiti",                flag: "🇭🇹", confederation: "CONCACAF" },
  { iso3: "CUW", iso2: "cw",     name: "Curaçao",              flag: "🇨🇼", confederation: "CONCACAF" },
  // CAF
  { iso3: "MAR", iso2: "ma",     name: "Morocco",              flag: "🇲🇦", confederation: "CAF"      },
  { iso3: "SEN", iso2: "sn",     name: "Senegal",              flag: "🇸🇳", confederation: "CAF"      },
  { iso3: "GHA", iso2: "gh",     name: "Ghana",                flag: "🇬🇭", confederation: "CAF"      },
  { iso3: "TUN", iso2: "tn",     name: "Tunisia",              flag: "🇹🇳", confederation: "CAF"      },
  { iso3: "EGY", iso2: "eg",     name: "Egypt",                flag: "🇪🇬", confederation: "CAF"      },
  { iso3: "CIV", iso2: "ci",     name: "Ivory Coast",          flag: "🇨🇮", confederation: "CAF"      },
  { iso3: "ALG", iso2: "dz",     name: "Algeria",              flag: "🇩🇿", confederation: "CAF"      },
  { iso3: "CPV", iso2: "cv",     name: "Cape Verde",           flag: "🇨🇻", confederation: "CAF"      },
  { iso3: "RSA", iso2: "za",     name: "South Africa",         flag: "🇿🇦", confederation: "CAF"      },
  { iso3: "COD", iso2: "cd",     name: "Congo DR",             flag: "🇨🇩", confederation: "CAF"      },
  // AFC
  { iso3: "JPN", iso2: "jp",     name: "Japan",                flag: "🇯🇵", confederation: "AFC"      },
  { iso3: "KOR", iso2: "kr",     name: "South Korea",          flag: "🇰🇷", confederation: "AFC"      },
  { iso3: "AUS", iso2: "au",     name: "Australia",            flag: "🇦🇺", confederation: "AFC"      },
  { iso3: "IRN", iso2: "ir",     name: "Iran",                 flag: "🇮🇷", confederation: "AFC"      },
  { iso3: "KSA", iso2: "sa",     name: "Saudi Arabia",         flag: "🇸🇦", confederation: "AFC"      },
  { iso3: "QAT", iso2: "qa",     name: "Qatar",                flag: "🇶🇦", confederation: "AFC"      },
  { iso3: "IRQ", iso2: "iq",     name: "Iraq",                 flag: "🇮🇶", confederation: "AFC"      },
  { iso3: "JOR", iso2: "jo",     name: "Jordan",               flag: "🇯🇴", confederation: "AFC"      },
  { iso3: "UZB", iso2: "uz",     name: "Uzbekistan",           flag: "🇺🇿", confederation: "AFC"      },
  // OFC
  { iso3: "NZL", iso2: "nz",     name: "New Zealand",          flag: "🇳🇿", confederation: "OFC"      },
];

export const COUNTRY_MAP = new Map(COUNTRIES.map((c) => [c.iso3, c]));
