package model

// SubjectInfo 应用运营主体信息。
type SubjectInfo struct {
	SubjectID          string `gorm:"column:subject_id;size:64;primaryKey" json:"subjectId"`
	SubjectNameCN      string `gorm:"column:subject_name_cn;size:256;not null" json:"subjectNameCn"`
	SubjectNameEN      string `gorm:"column:subject_name_en;size:256;not null" json:"subjectNameEn"`
	RegisteredAddress  string `gorm:"column:registered_address;size:512;not null" json:"registeredAddress"`
	RegistrationNumber string `gorm:"column:registration_number;size:64;not null;uniqueIndex" json:"registrationNumber"`
}
