package snowflake

import (
	"sync"
	"time"
)

// 简易雪花ID生成器（演示用）
// 结构：41位时间戳 + 10位机器ID + 12位序列号

const (
	epoch     = int64(1700000000000) // 自定义纪元 2023-11-14
	seqBits   = 12
	nodeBits  = 10
	seqMask   = int64(-1) ^ (int64(-1) << seqBits)
	nodeShift = seqBits
	timeShift = seqBits + nodeBits
)

var (
	mu        sync.Mutex
	lastTime  int64
	sequence  int64
	nodeID    int64 = 1
)

// NextID 生成下一个雪花ID
func NextID() int64 {
	mu.Lock()
	defer mu.Unlock()

	now := time.Now().UnixMilli() - epoch
	if now == lastTime {
		sequence = (sequence + 1) & seqMask
		if sequence == 0 {
			for now <= lastTime {
				now = time.Now().UnixMilli() - epoch
			}
		}
	} else {
		sequence = 0
	}
	lastTime = now

	return (now << timeShift) | (nodeID << nodeShift) | sequence
}
