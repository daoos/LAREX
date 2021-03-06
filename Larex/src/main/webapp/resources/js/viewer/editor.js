// Editor extends viewer
class Editor extends Viewer {
	constructor(segmenttypes, viewerInput, colors, controller) {
		super(segmenttypes, viewerInput, colors);
		this.isEditing = false;
		this._controller = controller;
		this._editModes = {default:-1,polygon:0,rectangle:1,border:2,line:3,move:4,scale:5,contours:6};
		this._editMode = this._editModes.default; 
		this._tempPathType;
		this._tempPath;
		this._tempPoint;
		this._tempID;
		this._tempMouseregion;
		this._tempEndCircle;
		this._grid = { isActive: false };
		this._readingOrder;
		this._guiOverlay = new paper.Group();
		this.mouseregions = { TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3, MIDDLE: 4, OUTSIDE: 5 };
		this.DoubleClickListener = new DoubleClickListener();
	}

	updateSegment(segmentID){
		super.updateSegment(segmentID);
		this.endEditing();
	}

	setEditSegment(id,displayPoints=true){
		this._paths[id].selected = displayPoints;
	}

	startRectangle(startFunction = () => {}, endFunction = (rectangle) => {}, updateFunction = (rectangle) => {}, borderStyle = 'none') {
		if (this.isEditing === false) {

			startFunction();

			const tool = new paper.Tool();
			tool.activate();
			tool.onMouseDown = (event) => {
				if (this.isEditing === true) { 
					const startPoint = event.point; 

					const imageCanvas = this.getImageCanvas();

					const tool = new paper.Tool();
					tool.activate();

					const canvasPoint = this.getPointInBounds(startPoint, this.getBoundaries());
					// Start path
					this._tempPoint = new paper.Path(canvasPoint);
					imageCanvas.addChild(this._tempPoint);
					this._tempPath = new paper.Path();
					this._tempPath.add(this._tempPoint); //Add Point for mouse movement
					this._tempPath.fillColor = '#bdbdbd';
					this._tempPath.strokeColor = '#424242';
					this._tempPath.opacity = 0.3;
					this._tempPath.closed = true;
					switch(borderStyle){
						case 'selected':
							this._tempPath.selected = true;
							break;
						case 'dashed':
							this._tempPath.dashArray = [5, 3];
							break;
						default:
							break;
					}

					tool.onMouseMove = (event) => {
						if (this.isEditing === true) {
							if (this._tempPath) {
								const point = this.getPointInBounds(event.point, this.getBoundaries());
								let rectangle = new paper.Path.Rectangle(this._tempPoint.firstSegment.point, point);

								this._tempPath.segments = rectangle.segments;
								
								updateFunction(rectangle);
							}
						} else {
							this.endRectangle(endFunction,this._tempPath);
							tool.remove();
						}
					}
					imageCanvas.addChild(this._tempPath);

					tool.onMouseUp = (event) => {
						this.endRectangle(endFunction,this._tempPath);
						tool.remove();
					}
				} else {
					tool.remove();
				}
			}
		}
	}

	endRectangle(endFunction = (rectangle) => {}, rectangle) {
		if (this.isEditing) {
			this.isEditing = false;
			if (this._tempPath != null) {
				endFunction(rectangle);
				this._tempPath.remove();
				this._tempPath = null;
			}
			if (this._tempPoint != null) {
				this._tempPoint.clear();
				this._tempPoint = null;
			}
			document.body.style.cursor = "auto";
		}
	}

	createRectangle(type) {
		if (this.isEditing === false) {
			this.startRectangle(
				()=>{
					this._editMode = 1;
					this.isEditing = true;
					this._tempPathType = type;
					document.body.style.cursor = "copy";
				},
				(rectangle)=>{
					this._tempPath.closed = true;
					this._tempPath.selected = false;
					switch (this._tempPathType) {
						case 'segment':
							this._controller.callbackNewSegment(this._convertPointsPathToSegment(rectangle, false));
							break;
						case 'region':
							this._controller.callbackNewRegion(this._convertPointsPathToSegment(rectangle, true));
							break;
						case 'ignore':
							this._controller.callbackNewRegion(this._convertPointsPathToSegment(rectangle, true), 'ignore');
							break;
						case 'roi':
						default:
							this._controller.callbackNewRoI(this._convertPointsPathToSegment(rectangle, true));
							break;
					}
				},
				(rectangle) => {},
				type === 'segment'? 'selected' : 'default');
		}
	}

	selectMultiple() {
		if (this.isEditing === false) {
			this.startRectangle(
				()=>{
					this._editMode = -1;
					this.isEditing = true;
				},
				(rectangle)=>{
					const selectBounds = this._tempPath.bounds;
					this._controller.rectangleSelect(selectBounds.topLeft, selectBounds.bottomRight);
				},
				(rectangle) => {},
				'dashed'
			);
		}
	}

	endRectangleSelect() {
		if (this.isEditing) {
			this.isEditing = false;
			if (this._tempPath != null) {
				const selectBounds = this._tempPath.bounds;
				this._controller.rectangleSelect(selectBounds.topLeft, selectBounds.bottomRight);

				this._tempPath.remove();
				this._tempPath = null;
			}
			if (this._tempPoint != null) {
				this._tempPoint.clear();
				this._tempPoint = null;
			}
		}
	}

	addRegion(region) {
		this.drawPath(region, true);
	}

	addLine(line) {
		this.drawPathLine(line);
	}

	removeLine(lineID) {
		this.removeSegment(lineID);
	}

	removeRegion(regionID) {
		this.endEditing();
		this.removeSegment(regionID);
	}

	startCreatePolygon(type) {
		if (this.isEditing === false) {
			this._editMode = 0;
			this.isEditing = true;
			this._tempPathType = type;
			document.body.style.cursor = "copy";

			const tool = new paper.Tool();
			tool.activate();
			tool.onMouseMove = (event) => {
				if (this._tempPath) {
					this._tempPath.removeSegment(this._tempPath.segments.length - 1);
					this._tempPath.add(this.getPointInBounds(event.point, this.getBoundaries()));
				}
			}

			this.DoubleClickListener.setAction((pos)=> {
				this.endCreatePolygon();
				this.DoubleClickListener.setActive(false);
			});
			this.DoubleClickListener.setActive(true);

			tool.onMouseDown = (event) => {
				this.DoubleClickListener.update(event.point);
				if (this.isEditing === true) {
					const canvasPoint = this.getPointInBounds(event.point, this.getBoundaries());

					if (!this._tempPath) {
						// Start path
						this._tempPath = new paper.Path();
						this._tempPath.add(new paper.Point(canvasPoint)); //Add Point for mouse movement
						this._tempPath.fillColor = 'grey';
						this._tempPath.opacity = 0.3;
						this._tempPath.closed = false;
						this._tempPath.selected = true;

						// circle to end the path
						this._tempEndCircle = new paper.Path.Circle(canvasPoint, 5);
						this._tempEndCircle.strokeColor = 'black';
						this._tempEndCircle.fillColor = 'grey';
						this._tempEndCircle.opacity = 0.5;
						this._tempEndCircle.onMouseDown = (event) => this.endCreatePolygon();

						let imageCanvas = this.getImageCanvas();
						imageCanvas.addChild(this._tempPath);
						imageCanvas.addChild(this._tempEndCircle);
					}
					this._tempPath.add(new paper.Point(canvasPoint));
				} else {
					tool.remove();
				}
			}
		}
	}

	endCreatePolygon() {
		if (this.isEditing) {
			this.isEditing = false;
			if (this._tempPath != null) {
				this._tempPath.closed = true;
				this._tempPath.selected = false;
				if (this._tempPathType === 'segment') {
					this._controller.callbackNewSegment(this._convertPointsPathToSegment(this._tempPath, false));
				} else {
					this._controller.callbackNewRegion(this._convertPointsPathToSegment(this._tempPath, true));
				}
				this._tempPath.remove();
				this._tempPath = null;
				this._tempEndCircle.remove();
			}
			document.body.style.cursor = "auto";
		}
	}

	startCreateLine() {
		if (this.isEditing === false) {
			this._editMode = 3;
			this.isEditing = true;
			document.body.style.cursor = "copy";

			const tool = new paper.Tool();
			tool.activate();
			tool.onMouseMove = (event) => {
				if (this._tempPath) {
					this._tempPath.removeSegment(this._tempPath.segments.length - 1);
					this._tempPath.add(this.getPointInBounds(event.point, this.getBoundaries()));
				}
			}

			this.DoubleClickListener.setAction((pos)=> {
				this.endCreateLine();
				this.DoubleClickListener.setActive(false);
			});
			this.DoubleClickListener.setActive(true);

			tool.onMouseDown = (event) => {
				this.DoubleClickListener.update(event.point);
				if (this.isEditing === true) {
					const canvasPoint = this.getPointInBounds(event.point, this.getBoundaries());

					if (!this._tempPath) {
						// Start path
						this._tempPath = new paper.Path();
						this._tempPath.add(new paper.Point(canvasPoint)); //Add Point for mouse movement
						this._tempPath.strokeColor = new paper.Color(0, 0, 0);
						this._tempPath.closed = false;
						this._tempPath.selected = true;

						this.getImageCanvas().addChild(this._tempPath);
					}
					this._tempPath.add(new paper.Point(canvasPoint));
				} else {
					tool.remove();
				}
			}
		}
	}

	endCreateLine() {
		if (this.isEditing) {
			this.isEditing = false;

			if (this._tempPath != null) {
				this._tempPath.closed = false;
				this._tempPath.selected = false;
				this._controller.callbackNewCut(this._convertPointsPathToSegment(this._tempPath, false));

				this._tempPath.remove();
				this._tempPath = null;
			}
			document.body.style.cursor = "auto";
		}
	}

	startCreateBorder(type) {
		if (this.isEditing === false) {
			this.isEditing = true;
			this._editMode = 2;
			this._tempPathType = type;

			const tool = new paper.Tool();
			tool.activate();

			if (!this._tempPath) {
				// Start path
				this._tempPath = new paper.Path();
				this._tempPath.fillColor = 'grey';
				this._tempPath.opacity = 0.5;
				this._tempPath.closed = true;
				//this._tempPath.selected = true;

				this.getImageCanvas().addChild(this._tempPath);
				tool.onMouseMove = (event) => {
					if (this.isEditing === true) {
						if (this._tempPath) {
							const boundaries = this.getBoundaries();
							const mouseregion = this.getMouseRegion(boundaries, event.point);
							this._tempMouseregion = mouseregion;

							let topleft, topright, rectangle, bottommouse, mouseright;
							switch (mouseregion) {
								case this.mouseregions.LEFT:
									document.body.style.cursor = "col-resize";

									topleft = new paper.Point(boundaries.left, boundaries.top);
									bottommouse = new paper.Point(event.point.x, boundaries.bottom);
									rectangle = new paper.Path.Rectangle(topleft, bottommouse);

									this._tempPath.segments = rectangle.segments;
									break;
								case this.mouseregions.RIGHT:
									document.body.style.cursor = "col-resize";

									topright = new paper.Point(boundaries.right, boundaries.top);
									bottommouse = new paper.Point(event.point.x, boundaries.bottom);
									rectangle = new paper.Path.Rectangle(topright, bottommouse);

									this._tempPath.segments = rectangle.segments;
									break;
								case this.mouseregions.TOP:
									document.body.style.cursor = "row-resize";

									topleft = new paper.Point(boundaries.left, boundaries.top);
									mouseright = new paper.Point(boundaries.right, event.point.y);
									rectangle = new paper.Path.Rectangle(topleft, mouseright);

									this._tempPath.segments = rectangle.segments;
									break;
								case this.mouseregions.BOTTOM:
									document.body.style.cursor = "row-resize";

									bottommouse = new paper.Point(boundaries.left, boundaries.bottom);
									mouseright = new paper.Point(boundaries.right, event.point.y);
									rectangle = new paper.Path.Rectangle(bottommouse, mouseright);

									this._tempPath.segments = rectangle.segments;
									break;
								case this.mouseregions.MIDDLE:
								default:
									this._tempPath.removeSegments();
									document.body.style.cursor = "copy";
									break;
							}
						}
					}
				}
				tool.onMouseDown = (event) => {
					if (this._tempPath) {
						this.endCreateBorder();
						tool.remove();
					}
				}
			}
		}
	}

	endCreateBorder() {
		if (this.isEditing) {
			this.isEditing = false;

			if (this._tempPath != null) {
				if (this._tempPathType === 'segment') {
					this._controller.callbackNewSegment(this._convertPointsPathToSegment(this._tempPath, false));
				} else {
					this._controller.callbackNewRegion(this._convertPointsPathToSegment(this._tempPath, true));
				}

				this._tempPath.remove();
				this._tempPath = null;
			}
			document.body.style.cursor = "auto";
		}
	}

	selectContours(contours){
		let contourBounds = [];
		
		contours.forEach(c => {
			let contourBound = {contour:c};
			let left = Number.POSITIVE_INFINITY;
			let right = Number.NEGATIVE_INFINITY;
			let top = Number.POSITIVE_INFINITY;
			let bottom = Number.NEGATIVE_INFINITY;

			c.forEach(p => {
				if(p.x < left) left = p.x;
				if(p.x > right) right = p.x;
				if(p.y < top) top = p.y;
				if(p.y > bottom) bottom = p.y;
			});

			contourBound.bounds = new paper.Rectangle(
					new paper.Point(
						this._convertPointToCanvas(left,top)),
					new paper.Point(
						this._convertPointToCanvas(right,bottom)));
			contourBound.bounds.visible = false;
			contourBounds.push(contourBound);
		});

		if (this.isEditing === false) {
			this.startRectangle(
				()=>{
					this._editMode = 6;
					this.isEditing = true;
				},
				(rectangle)=>{
					let selectedContours = contourBounds.filter(c => {return rectangle.contains(c.bounds)}).map(c => {return c.contour});
					this._controller.combineContours(selectedContours);
				},
				(rectangle) => {
					let selectedContours = contourBounds.filter(c => {return rectangle.contains(c.bounds)}).map(c => {return c.contour});
					this.showContours(selectedContours);
				},
				'dashed'
			);
		}
	}

	getContours(contours,rectangle){
		this._convertPointFromCanvas(selectBounds.topLeft);
		this._convertPointFromCanvas(selectBounds.bottomRight);
	}

	startMovePath(pathID, type, points) {
		if (this.isEditing === false) {
			this._editMode = 4;
			this.isEditing = true;
			this._tempPathType = type;
			document.body.style.cursor = "copy";

			// Create Copy of movable
			this._tempPath = new paper.Path(this.getPath(pathID).segments);
			this._tempID = pathID;
			this._tempPath.fillColor = 'grey';
			this._tempPath.opacity = 0.3;
			this._tempPath.closed = true;
			this._tempPath.strokeColor = 'black';
			this._tempPath.dashArray = [5, 3];

			// Set Grid
			this.setGrid(this._tempPath.position);

			// Position letiables between old and new path position
			this._tempPoint = new paper.Point(0, 0);
			const oldPosition = new paper.Point(this._tempPath.position);
			let oldMouse = null;

			const tool = new paper.Tool();
			tool.activate();
			tool.onMouseMove = (event) => {
				if (this.isEditing === true) {
					if (oldMouse === null) {
						oldMouse = event.point;
					}
					this._tempPoint = oldPosition.add(event.point.subtract(oldMouse));
					if (this._grid.isActive) 
						this._tempPoint = this.getPointFixedToGrid(this._tempPoint);

					if (!points) {
						this._tempPath.position = this._tempPoint;

						// Correct to stay in viewer bounds
						const tempPathBounds = this._tempPath.bounds;
						const pictureBounds = this.getBoundaries();
						let correctionPoint = new paper.Point(0, 0);
						if (tempPathBounds.left < pictureBounds.left) {
							correctionPoint = correctionPoint.add(new paper.Point((pictureBounds.left - tempPathBounds.left), 0));
						}
						if (tempPathBounds.right > pictureBounds.right) {
							correctionPoint = correctionPoint.subtract(new paper.Point((tempPathBounds.right - pictureBounds.right), 0));
						}
						if (tempPathBounds.top < pictureBounds.top) {
							correctionPoint = correctionPoint.add(new paper.Point(0, (pictureBounds.top - tempPathBounds.top)));
						}
						if (tempPathBounds.bottom > pictureBounds.bottom) {
							correctionPoint = correctionPoint.subtract(new paper.Point(0, (tempPathBounds.bottom - pictureBounds.bottom)));
						}
						this._tempPoint = this._tempPoint.add(correctionPoint);
						this._tempPath.position = this._tempPoint;
					} else {
						const delta = oldPosition.subtract(this._tempPoint);
						this._tempPath.removeSegments();
						const segments = this.getPath(this._tempID).segments.map(p => {
							let newPoint = p.point;
							const realPoint = this._convertPointFromCanvas(newPoint.x, newPoint.y);
							points.forEach(pp => {
								// Contains can not be trusted (TODO: propably?)
								if (realPoint.x === pp.x && realPoint.y === pp.y) {
									newPoint = new paper.Point(p.point.x - delta.x, p.point.y - delta.y);
								}
							});
							return new paper.Segment(newPoint);
						});
						this._tempPath.addSegments(segments);
					}
				} else {
					tool.remove();
				}
			}
			tool.onMouseUp = (event) => {
				if (this.isEditing === true) {
					this.endMovePath();
				}
				tool.remove();
			}
		}
	}

	endMovePath() {
		if (this.isEditing) {
			this.isEditing = false;

			if (this._tempPath !== null) {
				if (this._tempPathType === 'segment') {
					this._controller.transformSegment(this._tempID, this._convertPointsPathToSegment(this._tempPath, false));
				} else {
					this._controller.transformRegion(this._tempID, this._convertPointsPathToSegment(this._tempPath, true));
				}

				if(this._tempPath) this._tempPath.remove();
				this._tempPath = null;
			}

			document.body.style.cursor = "auto";
		}
	}

	startScalePath(pathID, type) {
		if (this.isEditing === false) {
			this._editMode = 5;
			this.isEditing = true;
			this._tempPathType = type;

			// Create Copy of movable
			const boundaries = this.getPath(pathID).bounds;
			this._tempPath = new paper.Path.Rectangle(boundaries);
			this.getImageCanvas().addChild(this._tempPath);
			this._tempID = pathID;
			this._tempPath.fillColor = 'grey';
			this._tempPath.opacity = 0.3;
			this._tempPath.closed = true;
			this._tempPath.strokeColor = 'black';
			this._tempPath.dashArray = [5, 3];

			const tool = new paper.Tool();
			tool.activate();
			tool.onMouseMove = (event) => {
				if (this.isEditing === true) {
					if (this._tempPath) {
						const mouseregion = this.getMouseRegion(this._tempPath.bounds, event.point, 0.1, 10);
						this._tempMouseregion = mouseregion;

						switch (mouseregion) {
							case this.mouseregions.LEFT:
							case this.mouseregions.RIGHT:
								document.body.style.cursor = "col-resize";
								break;
							case this.mouseregions.TOP:
							case this.mouseregions.BOTTOM:
								document.body.style.cursor = "row-resize";
								break;
							case this.mouseregions.MIDDLE:
							default:
								document.body.style.cursor = "auto";
								break;
						}
					}
				} else {
					tool.remove();
				}
			}
			tool.onMouseDown = (event) => {
				if (this.isEditing === true) {
					this.scalePath(this._tempPath, this._tempMouseregion);
				}
				tool.remove();
			}
		}
	}

	scalePath(path, mouseregion) {
		const tool = new paper.Tool();
		tool.activate();
		tool.onMouseMove = (event) => {
			if (this.isEditing === true) {
				if (this._tempPath) {
					const mouseinbound = this.getPointInBounds(event.point, this.getBoundaries());

					switch (mouseregion) {
						case this.mouseregions.LEFT:
							if (mouseinbound.x < path.bounds.right) {
								path.bounds.left = mouseinbound.x;
								document.body.style.cursor = "col-resize";
							}
							break;
						case this.mouseregions.RIGHT:
							if (mouseinbound.x > path.bounds.left) {
								path.bounds.right = mouseinbound.x;
								document.body.style.cursor = "col-resize";
							}
							break;
						case this.mouseregions.TOP:
							if (mouseinbound.y < path.bounds.bottom) {
								path.bounds.top = mouseinbound.y;
								document.body.style.cursor = "row-resize";
							}
							break;
						case this.mouseregions.BOTTOM:
							if (mouseinbound.y > path.bounds.top) {
								path.bounds.bottom = mouseinbound.y;
								document.body.style.cursor = "row-resize";
							}
							break;
						case this.mouseregions.MIDDLE:
						default:
							document.body.style.cursor = "auto";
							tool.remove();
							break;
					}
				}
			} else {
				tool.remove();
			}
		}
		tool.onMouseUp = (event) => {
			if (this.isEditing === true) {
				this.endScalePath();
			}
			tool.remove();
		}
	}

	endScalePath() {
		if (this.isEditing) {
			this.isEditing = false;

			if (this._tempPath != null) {
				const path = new paper.Path(this.getPath(this._tempID).segments);
				path.bounds = this._tempPath.bounds;

				this._tempPath.remove();

				if (this._tempPathType === 'segment') {
					this._controller.transformSegment(this._tempID, this._convertPointsPathToSegment(path, false));
				} else {
					this._controller.transformRegion(this._tempID, this._convertPointsPathToSegment(path, true));
				}

				this._tempPath = null;
			}

			document.body.style.cursor = "auto";
		}
	}

	getMouseRegion(bounds, mousepos, percentarea, minarea) {
		minarea = minarea ? minarea : 0;

		const width = bounds.width;
		const height = bounds.height;
		if (percentarea == null) {
			percentarea = 0.4;
		}
		//Calculate the height and width delta from the borders inwards to the center with minarea and percentarea 
		let widthDelta = width * percentarea;
		if (widthDelta < minarea) {
			if (minarea < width * 0.5) {
				widthDelta = minarea;
			} else {
				widthDelta = width * 0.5;
			}
		}
		let heightDelta = height * percentarea;
		if (heightDelta < minarea) {
			if (minarea < height * 0.5) {
				heightDelta = minarea;
			} else {
				heightDelta = height * 0.5;
			}
		}

		const leftmin = bounds.left;
		const leftmax = leftmin + widthDelta;

		const rightmax = bounds.right;
		const rightmin = rightmax - widthDelta;

		const topmin = bounds.top;
		const topmax = topmin + heightDelta;

		const bottommax = bounds.bottom;
		const bottommin = bottommax - heightDelta;
		if (mousepos.x < leftmin || mousepos.x > rightmax || mousepos.y < topmin || mousepos.y > bottommax) {
			return this.mouseregions.OUTSIDE;
		} else {
			//Get Mouse position/region
			if (mousepos.x > leftmin && mousepos.x < leftmax) {
				return this.mouseregions.LEFT;
			} else if (mousepos.x > rightmin && mousepos.x < rightmax) {
				return this.mouseregions.RIGHT;
			} else if (mousepos.y > topmin && mousepos.y < topmax) {
				return this.mouseregions.TOP;
			} else if (mousepos.y > bottommin && mousepos.y < bottommax) {
				return this.mouseregions.BOTTOM;
			} else {
				return this.mouseregions.MIDDLE;
			}
		}
	}

	startEditing() {
		this.isEditing = true;
	}

	endEditing() {
		this.isEditing = false;

		this._tempID = null;
		if (this._tempPath != null) {
			this._tempPath.remove();
			this._tempPath = null;
		}
		this._tempPoint = null;

		if (this._tempEndCircle) {
			this._tempEndCircle.remove();
			this._tempEndCircle = null;
		}

		document.body.style.cursor = "auto";
		this.hideContours();
	}

	getPointInBounds(point, bounds) {
		if (!bounds.contains(point)) {
			let boundPoint = point;
			if (point.x < bounds.left) {
				boundPoint.x = bounds.left;
			} else if (point.x > bounds.right) {
				boundPoint.x = bounds.right;
			}
			if (point.y < bounds.top) {
				boundPoint.y = bounds.top;
			} else if (point.y > bounds.bottom) {
				boundPoint.y = bounds.bottom;
			}

			return boundPoint;
		} else {
			return point;
		}
	}

	setGrid(point) {
		if (this._grid.vertical == null || this._grid.horizontal == null) {
			this._grid.vertical = new paper.Path.Line();
			this._grid.horizontal = new paper.Path.Line();
			this._grid.vertical.visible = false;
			this._grid.horizontal.visible = false;
		}
		const bounds = paper.view.bounds;
		this._grid.vertical.removeSegments();
		this._grid.vertical.add(new paper.Point(point.x, bounds.top));
		this._grid.vertical.add(new paper.Point(point.x, bounds.bottom));

		this._grid.horizontal.removeSegments();
		this._grid.horizontal.add(new paper.Point(bounds.left, point.y));
		this._grid.horizontal.add(new paper.Point(bounds.right, point.y));
	}

	addGrid() {
		this._grid.isActive = true;
	}

	removeGrid() {
		this._grid.isActive = false;
	}

	getPointFixedToGrid(point) {
		if (this._grid.isActive && this._grid.vertical != null && this._grid.horizontal != null) {
			const verticalFixedPoint = new paper.Point(this._grid.vertical.getPointAt(0).x, point.y);
			const horizontalFixedPoint = new paper.Point(point.x, this._grid.horizontal.getPointAt(0).y);
			if (verticalFixedPoint.getDistance(point) < horizontalFixedPoint.getDistance(point)) {
				return verticalFixedPoint;
			} else {
				return horizontalFixedPoint;
			}
		} else {
			return point;
		}
	}

	displayReadingOrder(readingOrder) {
		if (!this._readingOrder) {
			this._readingOrder = new paper.Path();
			this._readingOrder.strokeColor = 'indigo';
			this._readingOrder.strokeWidth = 2;
		}
		this.getImageCanvas().addChild(this._readingOrder);
		this._readingOrder.visible = false;
		this._guiOverlay.visible = false;
		this._readingOrder.removeSegments();
		this._guiOverlay.removeChildren();

		for (let index = 0; index < readingOrder.length; index++) {
			const segment = this.getPath(readingOrder[index]);
			if (segment) {
				this._readingOrder.add(new paper.Segment(segment.bounds.center));
				const text = new paper.PointText({
					point: segment.bounds.center,
					content: index,
					fillColor: 'white',
					strokeColor: 'black',
					fontFamily: 'Courier New',
					fontWeight: 'bold',
					fontSize: '16pt',
					strokeWidth: 1
				});

				this._guiOverlay.addChild(text);
			}
		}
	}

	hideReadingOrder() {
		if (this._readingOrder) {
			this._readingOrder.visible = false;
			this._guiOverlay.visible = false;
		}
	}

	getSortedReadingOrder(readingOrder) {
		const centers = {};
		for (let index = 0; index < readingOrder.length; index++) {
			const id = readingOrder[index];
			centers[id] = this.getPath(id).bounds.center;
		}

		readingOrder.sort(function (a, b) {
			const centerA = centers[a];
			const centerB = centers[b];
			const delta = centerA.y - centerB.y;
			if (delta != 0) {
				return delta;
			} else {
				return centerA.x - centerB.x;
			}
		});

		return readingOrder;
	}

	// Private Helper methods
	_convertPointsPathToSegment(path, isRelative) {
		const points = [];
		for (let pointItr = 0, pointMax = path.segments.length; pointItr < pointMax; pointItr++) {
			const point = path.segments[pointItr].point;
			if (isRelative) {
				points.push(this._convertPercentPointFromCanvas(point.x, point.y));
			} else {
				points.push(this._convertPointFromCanvas(point.x, point.y));
			}
		}

		return points;
	}

	getPointInBounds(point, bounds) {
		if (!bounds.contains(point)) {
			const boundPoint = point;
			if (point.x < bounds.left) {
				boundPoint.x = bounds.left;
			} else if (point.x > bounds.right) {
				boundPoint.x = bounds.right;
			}
			if (point.y < bounds.top) {
				boundPoint.y = bounds.top;
			} else if (point.y > bounds.bottom) {
				boundPoint.y = bounds.bottom;
			}

			return boundPoint;
		} else {
			return point;
		}
	}

	_fixGuiTextSize() {
		this._guiOverlay.children.forEach(function (element) {
			element.scaling = new paper.Point(1, 1);
		}, this);
		this._guiOverlay.bringToFront();
	}

	//***Inherintent functions***
	setImage(id) {
		super.setImage(id);
		this.getImageCanvas().addChild(this._guiOverlay);
	}
	setZoom(zoomfactor, point) {
		super.setZoom(zoomfactor, point);
		this._fixGuiTextSize();
	}
	zoomIn(zoomfactor, point) {
		super.zoomIn(zoomfactor, point);
		this._fixGuiTextSize();
	}
	zoomOut(zoomfactor, point) {
		super.zoomOut(zoomfactor, point);
		this._fixGuiTextSize();
	}
	zoomFit() {
		super.zoomFit();
		this._fixGuiTextSize();
	}
}

/* Adds double click functionality for paperjs canvas */
class DoubleClickListener{
	constructor(action = (pos) => {}, maxTime = 500, maxDistance = 20) {
		this._lastClickedTime = undefined;
		this._lastClickedPosition = undefined;
		this._maxTime = maxTime;
		this._maxDistance = maxDistance;
		this._action = action;
		this._isActive = false;
		this._date = new Date();
	}

	update(curMousePos,curTime = this._date.getTime()){
		if(this._isActive && this._lastClickedTime && this._lastClickedPosition &&
			this._lastClickedPosition.getDistance(curMousePos) <= this._maxDistance &&
			curTime - this._lastClickedTime <= this._maxTime)
		{
			this._action(curMousePos);
		}

		this._lastClickedPosition = curMousePos;
		this._lastClickedTime = curTime;
		
	}

	setActive(isActive = true){
		this._isActive = isActive;
	}

	setAction(action = (pos) => {}){
		this._action = action;
	}
}