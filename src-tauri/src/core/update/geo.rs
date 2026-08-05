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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get("http://ip-api.com/json/?fields=status,countryCode")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if json["status"].as_str() == Some("success") {
        if let Some(code) = json["countryCode"].as_str() {
            return Ok(code.to_string());
        }
    }
    Err("unable to resolve country code".into())
}
