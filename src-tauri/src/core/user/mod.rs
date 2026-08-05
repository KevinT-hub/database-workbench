// V2: DatabaseAdapter trait itself serves as the coordination layer.
// Commands call adapter.get_all_users () etc. directly — no intermediate wrapper needed.