export interface Country {
  iso3:          string;
  iso2:          string;
  name:          string;
  flag:          string;
  confederation: string;
}

export const COUNTRIES: Country[] = [
  { iso3: "ARG", iso2: "ar",     name: "Argentina",    flag: "🇦🇷", confederation: "CONMEBOL" },
  { iso3: "BRA", iso2: "br",     name: "Brazil",       flag: "🇧🇷", confederation: "CONMEBOL" },
  { iso3: "FRA", iso2: "fr",     name: "France",       flag: "🇫🇷", confederation: "UEFA"     },
  { iso3: "ENG", iso2: "gb-eng", name: "England",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA"     },
  { iso3: "ESP", iso2: "es",     name: "Spain",        flag: "🇪🇸", confederation: "UEFA"     },
  { iso3: "GER", iso2: "de",     name: "Germany",      flag: "🇩🇪", confederation: "UEFA"     },
  { iso3: "POR", iso2: "pt",     name: "Portugal",     flag: "🇵🇹", confederation: "UEFA"     },
  { iso3: "NED", iso2: "nl",     name: "Netherlands",  flag: "🇳🇱", confederation: "UEFA"     },
  { iso3: "BEL", iso2: "be",     name: "Belgium",      flag: "🇧🇪", confederation: "UEFA"     },
  { iso3: "ITA", iso2: "it",     name: "Italy",        flag: "🇮🇹", confederation: "UEFA"     },
  { iso3: "URU", iso2: "uy",     name: "Uruguay",      flag: "🇺🇾", confederation: "CONMEBOL" },
  { iso3: "CRO", iso2: "hr",     name: "Croatia",      flag: "🇭🇷", confederation: "UEFA"     },
  { iso3: "COL", iso2: "co",     name: "Colombia",     flag: "🇨🇴", confederation: "CONMEBOL" },
  { iso3: "MEX", iso2: "mx",     name: "Mexico",       flag: "🇲🇽", confederation: "CONCACAF" },
  { iso3: "USA", iso2: "us",     name: "USA",          flag: "🇺🇸", confederation: "CONCACAF" },
  { iso3: "CAN", iso2: "ca",     name: "Canada",       flag: "🇨🇦", confederation: "CONCACAF" },
  { iso3: "MAR", iso2: "ma",     name: "Morocco",      flag: "🇲🇦", confederation: "CAF"      },
  { iso3: "SEN", iso2: "sn",     name: "Senegal",      flag: "🇸🇳", confederation: "CAF"      },
  { iso3: "JPN", iso2: "jp",     name: "Japan",        flag: "🇯🇵", confederation: "AFC"      },
  { iso3: "KOR", iso2: "kr",     name: "South Korea",  flag: "🇰🇷", confederation: "AFC"      },
  { iso3: "AUS", iso2: "au",     name: "Australia",    flag: "🇦🇺", confederation: "AFC"      },
  { iso3: "ECU", iso2: "ec",     name: "Ecuador",      flag: "🇪🇨", confederation: "CONMEBOL" },
  { iso3: "POL", iso2: "pl",     name: "Poland",       flag: "🇵🇱", confederation: "UEFA"     },
  { iso3: "DEN", iso2: "dk",     name: "Denmark",      flag: "🇩🇰", confederation: "UEFA"     },
  { iso3: "CHE", iso2: "ch",     name: "Switzerland",  flag: "🇨🇭", confederation: "UEFA"     },
  { iso3: "WAL", iso2: "gb-wls", name: "Wales",        flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", confederation: "UEFA"     },
  { iso3: "SRB", iso2: "rs",     name: "Serbia",       flag: "🇷🇸", confederation: "UEFA"     },
  { iso3: "TUN", iso2: "tn",     name: "Tunisia",      flag: "🇹🇳", confederation: "CAF"      },
  { iso3: "CRC", iso2: "cr",     name: "Costa Rica",   flag: "🇨🇷", confederation: "CONCACAF" },
  { iso3: "GHA", iso2: "gh",     name: "Ghana",        flag: "🇬🇭", confederation: "CAF"      },
  { iso3: "CMR", iso2: "cm",     name: "Cameroon",     flag: "🇨🇲", confederation: "CAF"      },
  { iso3: "IRN", iso2: "ir",     name: "Iran",         flag: "🇮🇷", confederation: "AFC"      },
];

export const COUNTRY_MAP = new Map(COUNTRIES.map((c) => [c.iso3, c]));
