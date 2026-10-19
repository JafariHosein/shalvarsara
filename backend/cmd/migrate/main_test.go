package main

import "testing"

func TestParseArgs(t *testing.T) {
	tests := []struct {
		name      string
		args      []string
		wantCmd   string
		wantSteps int
		wantErr   bool
	}{
		{name: "no args applies everything", args: nil, wantCmd: "up", wantSteps: 0},
		{name: "explicit up", args: []string{"up"}, wantCmd: "up", wantSteps: 0},
		{name: "down defaults to one step", args: []string{"down"}, wantCmd: "down", wantSteps: 1},
		{name: "down with a count", args: []string{"down", "3"}, wantCmd: "down", wantSteps: 3},
		{name: "down all is unbounded", args: []string{"down", "all"}, wantCmd: "down", wantSteps: 0},

		{name: "unknown command", args: []string{"sideways"}, wantErr: true},
		{name: "up takes no argument", args: []string{"up", "2"}, wantErr: true},
		{name: "zero is not a count", args: []string{"down", "0"}, wantErr: true},
		{name: "negative is not a count", args: []string{"down", "-1"}, wantErr: true},
		{name: "garbage count", args: []string{"down", "lots"}, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd, steps, err := parseArgs(tt.args)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("parseArgs(%q) = (%q, %d, nil), want an error", tt.args, cmd, steps)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseArgs(%q) returned an unexpected error: %v", tt.args, err)
			}
			if cmd != tt.wantCmd || steps != tt.wantSteps {
				t.Fatalf("parseArgs(%q) = (%q, %d), want (%q, %d)", tt.args, cmd, steps, tt.wantCmd, tt.wantSteps)
			}
		})
	}
}
