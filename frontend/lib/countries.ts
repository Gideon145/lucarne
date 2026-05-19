export interface Country {
  iso3:          string;
  name:          string;
  flag:          string;
  confederation: string;
}

export const COUNTRIES: Country[] = [
  { iso3: "ARG", name: "Argentina",    flag: "🇦🇷", confederation: "CONMEBOL" },
  { iso3: "BRA", name: "Brazil",       flag: "🇧🇷", confederation: "CONMEBOL" },
  { iso3: "FRA", name: "France",       flag: "🇫🇷", confederation: "UEFA"     },
  { iso3: "ENG", name: "England",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA"     },
  { iso3: "ESP", name: "Spain",        flag: "🇪🇸", confederation: "UEFA"     },
  { iso3: "GER", name: "Germany",      flag: "🇩🇪", confederation: "UEFA"     },
  { iso3: "POR", name: "Portugal",     flag: "🇵🇹", confederation: "UEFA"     },
  { iso3: "NED", name: "Netherlands",  flag: "🇳🇱", confederation: "UEFA"     },
  { iso3: "BEL", name: "Belgium",      flag: "🇧🇪", confederation: "UEFA"     },
  { iso3: "ITA", name: "Italy",        flag: "🇮🇹", confederation: "UEFA"     },
  { iso3: "URU", name: "Uruguay",      flag: "🇺🇾", confederation: "CONMEBOL" },
  { iso3: "CRO", name: "Croatia",      flag: "🇭🇷", confederation: "UEFA"     },
  { iso3: "COL", name: "Colombia",     flag: "🇨🇴", confederation: "CONMEBOL" },
  { iso3: "MEX", name: "Mexico",       flag: "🇲🇽", confederation: "CONCACAF" },
  { iso3: "USA", name: "USA",          flag: "🇺🇸", confederation: "CONCACAF" },
  { iso3: "CAN", name: "Canada",       flag: "🇨🇦", confederation: "CONCACAF" },
  { iso3: "MAR", name: "Morocco",      flag: "🇲🇦", confederation: "CAF"      },
  { iso3: "SEN", name: "Senegal",      flag: "🇸🇳", confederation: "CAF"      },
  { iso3: "JPN", name: "Japan",        flag: "🇯🇵", confederation: "AFC"      },
  { iso3: "KOR", name: "South Korea",  flag: "🇰🇷", confederation: "AFC"      },
  { iso3: "AUS", name: "Australia",    flag: "🇦🇺", confederation: "AFC"      },
  { iso3: "ECU", name: "Ecuador",      flag: "🇪🇨", confederation: "CONMEBOL" },
  { iso3: "POL", name: "Poland",       flag: "🇵🇱", confederation: "UEFA"     },
  { iso3: "DEN", name: "Denmark",      flag: "🇩🇰", confederation: "UEFA"     },
  { iso3: "CHE", name: "Switzerland",  flag: "🇨🇭", confederation: "UEFA"     },
  { iso3: "WAL", name: "Wales",        flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", confederation: "UEFA"     },
  { iso3: "SRB", name: "Serbia",       flag: "🇷🇸", confederation: "UEFA"     },
  { iso3: "TUN", name: "Tunisia",      flag: "🇹🇳", confederation: "CAF"      },
  { iso3: "CRC", name: "Costa Rica",   flag: "🇨🇷", confederation: "CONCACAF" },
  { iso3: "GHA", name: "Ghana",        flag: "🇬🇭", confederation: "CAF"      },
  { iso3: "CMR", name: "Cameroon",     flag: "🇨🇲", confederation: "CAF"      },
  { iso3: "IRN", name: "Iran",         flag: "🇮🇷", confederation: "AFC"      },
];

export const COUNTRY_MAP = new Map(COUNTRIES.map((c) => [c.iso3, c]));
