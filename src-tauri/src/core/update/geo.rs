use std::sync::Mutex;

pub struct CountryCodeCache {
    code: Mutex<Option<String>>,
}

impl CountryCodeCache {
    pub fn new() -> Self {
        Self { code: Mutex::new(None) }
    }

    pub fn get(&self) -> Option<String> {
        self.code.lock().unwrap().clone()
    }

    pub fn set(&self, code: String) {
        *self.code.lock().unwrap() = Some(code);
    }
}

pub async fn warmup_cache() -> Result<String, String> {
    // Try several free geo services in order; the first successful response wins.
    let sources = [
        ("http://ip-api.com/json/?fields=status,countryCode", "countryCode"),
        ("https://api.country.is", "country"),
        ("https://ipinfo.io/json", "country"),
    ];

    for (url, field) in sources {
        if let Ok(code) = fetch_country_code(url, field).await {
            return Ok(code);
        }
    }

    Err("unable to resolve country code".into())
}

async fn fetch_country_code(url: &str, field: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if let Some(code) = json[field].as_str() {
        if code.len() == 2 {
            return Ok(code.to_uppercase());
        }
    }
    Err("no country code in response".into())
}
