class Selector {
	constructor(editor, controller) {
		this._controller = controller;
		this._editor = editor;
		this.selectmultiple = false;
		this.selectpoints = false;
		this.isSelecting = false;
		this._selectedSegments = [];
		this._selectedPoints = [];
		this._selectedContours = [];
		this._typeLastSelected;
	}

	select(segmentID, points = []) {
		const typeSelected = this._controller.getIDType(segmentID);
		if(this._typeLastSelected !== typeSelected || !this.selectmultiple)
			this.unSelect();
		
		this._typeLastSelected = typeSelected;
		
		if(!(this._selectedSegments.length === 1 && this._selectedSegments[0] === segmentID)){
			this._selectedSegments.forEach(s => this._editor.setEditSegment(s,false));
			this._processSelectSegment(segmentID);
		}
		
		if(this._selectedSegments.length === 1){
			if(typeSelected === 'segment'){
				this._editor.setEditSegment(this._selectedSegments[0]);
				points.forEach(p => this._processSelectPoint(p,segmentID));
			} else if(typeSelected === 'region'){
				this._controller.scaleSelected();
			}
		}

	}

	unSelect() {
		this._selectedSegments.forEach(segmentID => {
			this._editor.selectSegment(segmentID, false);
			this._editor.setEditSegment(segmentID,false)
		});

		this._selectedSegments = [];
		this._selectedPoints = [];
		this._selectedContours = [];
	}

	hasSegmentsSelected() {
		if (this._selectedSegments && _selected.length > 0) {
			return true;
		} else {
			return false;
		}
	}
	isSegmentSelected(segmentID) {
		if (this._selectedSegments && $.inArray(segmentID, this._selectedSegments) >= 0) {
			return true;
		} else {
			return false;
		}
	}
	selectMultiple() {
		if (!this._editor.isEditing) {
			if (!this.isSelecting) {
				this._editor.selectMultiple();
			}

			this.isSelecting = true;
		}
	}

	rectangleSelect(pointA, pointB) {
		if(this._selectedSegments.length !== 1 || this._typeLastSelected !== 'segment'){
			if ((!this.selectmultiple) || this._typeLastSelected !== 'segment') 
				this.unSelect();

			const inbetween = this._editor.getSegmentIDsBetweenPoints(pointA, pointB);

			inbetween.forEach((id) => {
				const idType = this._controller.getIDType(id);
				if (idType === 'segment') {
					this._selectedSegments.push(id);
					this._editor.selectSegment(id, true);
				}
			});
		} else {
			const segmentID = this._selectedSegments[0];
			const inbetween = this._editor.selectPointsInbetween(pointA, pointB, segmentID);

			inbetween.forEach((point) => {
				if (this._selectedPoints.indexOf(point) < 0) {
					// Has not been selected before => select
					this._selectedPoints.push(point);
				}
			});
		}

		this.isSelecting = false;
	}

	getSelectedSegments() {
		return this._selectedSegments;
	}

	getSelectedPoints() {
		return this._selectedPoints;
	}

	getSelectedContours() {
		return this._selectedContours;
	}

	getSelectedPolygonType() {
		return this._typeLastSelected;
	}

	//***** private methods ****//
	// Handels if a point has to be selected or unselected
	_processSelectPoint(point, segmentID, toggle = true) {
		const selectIndex = this._selectedPoints.indexOf(point);
		if (selectIndex < 0 || !toggle) {
			// Has not been selected before => select
			if (point) {
				this._selectedPoints.push(point);
				this._editor.selectSegment(segmentID, true, false, point);
			}
		} else {
			// Has been selected before => unselect
			if (point) {
				this._selectedPoints.splice(selectIndex, 1);
				this._editor.selectSegment(segmentID, false, false, point);
			}
		}
	}

	// Handels if a segment has to be selected or unselected
	_processSelectSegment(segmentID) {
		const selectIndex = this._selectedSegments.indexOf(segmentID);
		if (selectIndex < 0) {
			// Has not been selected before => select
			this._selectedSegments.push(segmentID);
			this._editor.selectSegment(segmentID, true, false);
		} else {
			// Has been selected before => unselect
			this._selectedSegments.splice(selectIndex, 1);
			this._editor.selectSegment(segmentID, false, false);
		}
	}
}
