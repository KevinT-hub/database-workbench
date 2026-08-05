use std::collections::HashMap;
use std::sync::Mutex;
use crate::models::backup::ScheduleRequest;

pub struct SchedulerHandle {
    schedules: Mutex<HashMap<u64, ScheduleRequest>>,
    next_id: Mutex<u64>,
}

impl SchedulerHandle {
    pub fn new() -> Self {
        Self {
            schedules: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }

    pub fn add(&self, request: ScheduleRequest) -> u64 {
        let mut id = self.next_id.lock().unwrap();
        let schedule_id = *id;
        *id += 1;
        self.schedules.lock().unwrap().insert(schedule_id, request);
        schedule_id
    }

    pub fn remove(&self, schedule_id: u64) -> bool {
        self.schedules.lock().unwrap().remove(&schedule_id).is_some()
    }

    pub fn list(&self) -> Vec<(u64, ScheduleRequest)> {
        self.schedules.lock().unwrap().iter().map(|(k, v)| (*k, v.clone())).collect()
    }
}
